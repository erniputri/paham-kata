import { searchMeanings } from "../services/searchService.js";
import { recordSearchHistory } from "../storage/historyStorage.js";

const PENDING_SELECTION_KEY = "pendingSelection";
const MAX_TERM_LENGTH = 80;
const MAX_TERM_WORDS = 5;

function validateTerm(value) {
  if (typeof value !== "string" || /[\r\n]/.test(value)) return "";
  const term = value.trim().replace(/\s+/g, " ");
  if (!term || term.length > MAX_TERM_LENGTH || term.split(" ").length > MAX_TERM_WORDS) {
    return "";
  }
  return term;
}

function supportedWebSender(sender) {
  const url = sender.tab?.url || sender.url || "";
  return /^https?:\/\//i.test(url);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const isTabSearch = message?.type === "KNOWBYTE_SEARCH_SELECTION";
  const isQuickDefinition = message?.type === "KNOWBYTE_QUICK_DEFINITION";
  if (!isTabSearch && !isQuickDefinition) return undefined;

  (async () => {
    if (!supportedWebSender(sender)) {
      sendResponse({ ok: false, reason: "unsupported-page" });
      return;
    }

    const term = validateTerm(message.term);
    if (!term) {
      sendResponse({ ok: false, reason: "invalid-term" });
      return;
    }

    const settings = await chrome.storage.local.get({ selectTextEnabled: true });
    if (settings.selectTextEnabled === false) {
      sendResponse({ ok: false, reason: "disabled" });
      return;
    }

    if (isQuickDefinition) {
      try {
        await recordSearchHistory(term);
      } catch (historyError) {
        console.warn("Quick Definition history could not be saved:", historyError);
      }
      try {
        const result = await searchMeanings(term);
        sendResponse({
          ok: true,
          result: {
            currentWord: result.currentWord,
            translationUnavailable: result.translationUnavailable,
          },
        });
      } catch (error) {
        sendResponse({
          ok: false,
          error: {
            kind: error?.kind || "error",
            message: error?.message || "Pencarian tidak dapat diselesaikan.",
          },
        });
      }
      return;
    }

    const now = Date.now();
    const pendingStorage = chrome.storage.session || chrome.storage.local;
    await pendingStorage.set({
      [PENDING_SELECTION_KEY]: {
        term,
        createdAt: now,
        expiresAt: now + 30000,
      },
    });

    const pageUrl = chrome.runtime.getURL("popup.html?view=tab");
    await chrome.tabs.create({ url: pageUrl, active: true });
    sendResponse({ ok: true });
  })().catch((error) => {
    console.error("Select & Click request failed:", error);
    sendResponse({ ok: false, reason: "open-failed" });
  });

  return true;
});

