import { searchMeanings } from "./js/services/searchService.js";
import {
  deleteGlossaryItem,
  readGlossary,
  saveGlossaryItem,
} from "./js/storage/glossaryStorage.js";
import {
  clearSearchHistory,
  loadSearchHistory,
  recordSearchHistory,
  removeSearchHistoryTerm,
} from "./js/storage/historyStorage.js";
import { initializeSearchUI } from "./js/ui/searchUI.js";
import { initializeGlossaryUI } from "./js/ui/glossaryUI.js";
import { initializeModalUI } from "./js/ui/modalUI.js";
import { getSelectedTextFromActiveTab } from "./js/features/selectText.js";

let currentWord = null;
let activeSearchId = 0;
const LAST_SEARCH_RESULT_KEY = "lastSearchResult";

function restoreSearchResult(savedResult, term) {
  if (!savedResult || savedResult.term !== term || !savedResult.currentWord) return false;
  const state = savedResult.state;
  if (!state || !Array.isArray(state.lookupErrors)) return false;
  currentWord = savedResult.currentWord;
  searchUI.setSearchTerm(term);
  searchUI.renderResult(currentWord, state);
  return true;
}

function rememberSearchResult(term, result) {
  if (!chrome.storage.session) return;
  const state = {
    lookupErrors: result.lookupErrors.map((error) => ({ kind: error?.kind || "error" })),
    translationUnavailable: result.translationUnavailable,
    programmingContextsLimited: result.programmingContextsLimited,
  };
  chrome.storage.session.set({
    [LAST_SEARCH_RESULT_KEY]: { term, currentWord: result.currentWord, state },
  }).catch((error) => console.warn("Last search result could not be saved:", error));
}

async function loadGlossary() {
  try {
    const glossary = await readGlossary();
    glossaryUI.render(glossary);
  } catch (error) {
    glossaryUI.showLoadError(error);
  }
}

async function confirmGlossaryDeletion(item) {
  await deleteGlossaryItem(item);
  await loadGlossary();
}

const modalUI = initializeModalUI({ onConfirmDelete: confirmGlossaryDeletion });

async function clearHistory() {
  try {
    const history = await clearSearchHistory();
    searchUI.renderHistory(history);
    searchUI.clearHistoryStatus();
  } catch (error) {
    searchUI.showHistoryError(error);
  }
}

async function deleteHistoryTerm(term) {
  try {
    const history = await removeSearchHistoryTerm(term);
    searchUI.renderHistory(history);
    searchUI.clearHistoryStatus();
  } catch (error) {
    searchUI.showHistoryError(error);
  }
}
const searchUI = initializeSearchUI({
  onSearch: searchWord,
  onHistorySearch(term) {
    searchUI.setSearchTerm(term);
    document.getElementById("searchHistorySection").hidden = true;
    document.querySelector(".search-section").hidden = false;
    document.getElementById("resultSection").hidden = false;
    searchWord();
  },
  onClearHistory: clearHistory,
  onDeleteHistory: deleteHistoryTerm,
});

const glossaryUI = initializeGlossaryUI({
  onOpen: loadGlossary,
  onSearch: loadGlossary,
  onDelete: (item, trigger) => modalUI.openDeleteModal(item, trigger),
});

async function searchWord() {
  const searchId = ++activeSearchId;
  const word = searchUI.getSearchTerm();
  if (!word) {
    currentWord = null;
    searchUI.showRequiredTerm();
    searchUI.setBusy(false);
    return;
  }

  recordSearchHistory(word).then((history) => {
    searchUI.renderHistory(history);
    searchUI.clearHistoryStatus();
  }).catch((error) => searchUI.showHistoryError(error));

  searchUI.setBusy(true);
  searchUI.showSearching();
  currentWord = null;

  try {
    const result = await searchMeanings(word);
    if (searchId !== activeSearchId) return;
    currentWord = result.currentWord;
    searchUI.renderResult(currentWord, result);
    rememberSearchResult(word, result);
  } catch (error) {
    if (searchId !== activeSearchId) return;
    currentWord = null;
    searchUI.showSearchError(error);
  } finally {
    if (searchId === activeSearchId) searchUI.setBusy(false);
  }
}

document.getElementById("saveBtn").addEventListener("click", async () => {
  if (!currentWord) return;
  const saveBtn = document.getElementById("saveBtn");
  saveBtn.disabled = true;
  try {
    const result = await saveGlossaryItem(currentWord);
    if (result.duplicate) {
      modalUI.showDuplicateSave();
      return;
    }
    modalUI.showSaveSuccess();
  } catch (error) {
    console.error("Save Error:", error);
    alert("Gagal menyimpan istilah.");
  } finally {
    saveBtn.disabled = false;
  }
});

async function initializePopup() {
  const selectTextToggle = document.getElementById("selectTextToggle");
  const pageView = new URLSearchParams(window.location.search).get("view") === "tab";
  if (pageView) document.body.classList.add("extension-page");

  selectTextToggle.disabled = true;
  let settings = { lastManualSearchTerm: "", selectTextEnabled: true };
  try {
    settings = await chrome.storage.local.get(settings);
  } catch (error) {
    console.warn("Popup settings could not be restored:", error);
  }
  selectTextToggle.checked = settings.selectTextEnabled !== false;

  selectTextToggle.disabled = false;

  let savedResult = null;
  try {
    savedResult = (await chrome.storage.session?.get(LAST_SEARCH_RESULT_KEY))?.[LAST_SEARCH_RESULT_KEY];
  } catch (error) {
    console.warn("Last search result could not be restored:", error);
  }

  let pendingSelection = null;
  try {
    const pendingStorage = chrome.storage.session || chrome.storage.local;
    const data = await pendingStorage.get("pendingSelection");
    pendingSelection = data.pendingSelection || null;
    if (pendingSelection) await pendingStorage.remove("pendingSelection");
  } catch (error) {
    console.warn("Pending selection could not be read:", error);
  }

  const selectedTerm = typeof pendingSelection?.term === "string"
    ? pendingSelection.term.trim()
    : "";
  const isFreshSelection =
    selectedTerm.length > 0 &&
    selectedTerm.length <= 80 &&
    !/[\r\n]/.test(selectedTerm) &&
    selectedTerm.split(/\s+/).length <= 5 &&
    Number.isFinite(pendingSelection.expiresAt) &&
    pendingSelection.expiresAt > Date.now();

  if (isFreshSelection) {
    if (!restoreSearchResult(savedResult, selectedTerm)) {
      searchUI.setSearchTerm(selectedTerm);
      await searchWord();
    }
    return;
  }

  if (!pageView && selectTextToggle.checked) {
    try {
      const selectedText = await getSelectedTextFromActiveTab();
      if (selectedText) {
        if (!restoreSearchResult(savedResult, selectedText)) {
          searchUI.setSearchTerm(selectedText);
          await searchWord();
        }
        return;
      }
    } catch (error) {
      console.warn("Select & Click unavailable:", error);
    }
  }

  if (typeof savedResult?.term === "string" && restoreSearchResult(savedResult, savedResult.term)) return;
  if (typeof settings.lastManualSearchTerm === "string") {
    searchUI.setSearchTerm(settings.lastManualSearchTerm);
  }
}
document.getElementById("wordInput").addEventListener("input", (event) => {
  chrome.storage.local.set({ lastManualSearchTerm: event.target.value }).catch((error) => {
    console.warn("Manual search term could not be saved:", error);
  });
});

document.getElementById("selectTextToggle").addEventListener("change", (event) => {
  chrome.storage.local.set({ selectTextEnabled: event.target.checked }).catch((error) => {
    console.warn("Select & Click setting could not be saved:", error);
  });
});
loadSearchHistory()
  .then((history) => searchUI.renderHistory(history))
  .catch((error) => searchUI.showHistoryError(error));
initializePopup();