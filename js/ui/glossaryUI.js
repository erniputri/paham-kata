import {
  InvalidGlossaryDataError,
  isValidGlossaryItem,
  getProgrammingMeanings,
} from "../storage/glossaryStorage.js";

const elements = {
  searchSection: document.querySelector(".search-section"),
  resultSection: document.getElementById("resultSection"),
  searchHistorySection: document.getElementById("searchHistorySection"),
  popupContainer: document.querySelector(".container"),
  glossaryBtn: document.getElementById("glossaryBtn"),
  glossarySection: document.getElementById("glossarySection"),
  glossaryList: document.getElementById("glossaryList"),
  glossaryEmpty: document.getElementById("glossaryEmpty"),
  glossaryNoResults: document.getElementById("glossaryNoResults"),
  glossaryCount: document.getElementById("glossaryCount"),
  glossaryDataWarning: document.getElementById("glossaryDataWarning"),
  glossarySearch: document.getElementById("glossarySearch"),
  backBtn: document.getElementById("backBtn"),
  generalCategoryBtn: document.getElementById("generalGlossaryCategory"),
  programmingCategoryBtn: document.getElementById("programmingGlossaryCategory"),
};

let activeGlossaryCategory = "general";

function renderGlossary(storedGlossary, onDelete) {
  const glossary = storedGlossary.filter(isValidGlossaryItem);
  const invalidCount = storedGlossary.length - glossary.length;

  elements.glossaryCount.textContent = glossary.length;
  elements.glossaryList.replaceChildren();
  elements.glossaryDataWarning.hidden = invalidCount === 0;
  if (invalidCount > 0) {
    elements.glossaryDataWarning.textContent =
      invalidCount + " entri tidak dapat dibaca dan dilewati. Data tersimpan tidak diubah.";
  }

  if (storedGlossary.length === 0) {
    elements.glossaryEmpty.hidden = false;
    elements.glossaryNoResults.hidden = true;
    return;
  }
  elements.glossaryEmpty.hidden = true;
  if (glossary.length === 0) {
    elements.glossaryNoResults.hidden = true;
    return;
  }

  const keyword = elements.glossarySearch.value.trim().toLowerCase();
  const filteredGlossary = glossary.filter((item) => {
    const programming = getProgrammingMeanings(item.programmingMeaning);
    const hasStructuredMeaning = Boolean(item.generalMeaning || programming.length);
    const general = item.generalMeaning || (!hasStructuredMeaning
      ? { definition: item.definition, translation: item.translation }
      : null);
    const categoryMatches = activeGlossaryCategory === "general"
      ? Boolean(general)
      : programming.length > 0;
    if (!categoryMatches) return false;
    const fields = activeGlossaryCategory === "general"
      ? [item.word, general.definition, general.translation, general.partOfSpeech]
      : [item.word, ...programming.flatMap((meaning) => [
          meaning.term, meaning.category, meaning.definition, meaning.simpleExplanation,
        ])];
    return fields.some((value) =>
      typeof value === "string" && value.toLowerCase().includes(keyword),
    );
  });

  if (filteredGlossary.length === 0) {
    elements.glossaryNoResults.hidden = false;
    return;
  }
  elements.glossaryNoResults.hidden = true;

  filteredGlossary.forEach((item) => {
    const programming = getProgrammingMeanings(item.programmingMeaning);
    const hasStructuredMeaning = Boolean(item.generalMeaning || programming.length);
    const general = item.generalMeaning || (!hasStructuredMeaning
      ? { definition: item.definition, translation: item.translation }
      : null);
    const glossaryItem = document.createElement("details");
    glossaryItem.className = "glossary-item";
    const summary = document.createElement("summary");
    summary.className = "glossary-item-summary";
    const word = document.createElement("strong");
    word.className = "glossary-term";
    word.textContent = item.word;
    const shortInfo = document.createElement("span");
    shortInfo.className = "glossary-short-info";
    shortInfo.textContent = activeGlossaryCategory === "general"
      ? "Makna umum dan terjemahan"
      : programming.length + " konteks pemrograman";
    summary.append(word, shortInfo);
    glossaryItem.appendChild(summary);

    const detail = document.createElement("div");
    detail.className = "glossary-item-detail";
    if (activeGlossaryCategory === "general" && general) {
      const definition = document.createElement("p");
      definition.className = "definition";
      definition.textContent = general.definition || "";
      const translation = document.createElement("p");
      translation.className = "translation";
      translation.textContent = general.translation
        ? "Terjemahan: " + general.translation
        : "Terjemahan belum tersedia.";
      detail.append(definition, translation);
    } else if (activeGlossaryCategory === "programming") {
      programming.forEach((meaning) => {
        const block = document.createElement("div");
        block.className = "glossary-meaning glossary-programming";
        const heading = document.createElement("strong");
        heading.textContent = "Pemrograman · " + (meaning.category || "Programming Concept");
        const definition = document.createElement("p");
        definition.className = "definition";
        definition.textContent = meaning.definition || "";
        block.append(heading, definition);
        if (meaning.simpleExplanation) {
          const explanation = document.createElement("p");
          explanation.className = "translation";
          explanation.textContent = meaning.simpleExplanation;
          block.appendChild(explanation);
        }
        detail.appendChild(block);
      });
    }

    const actions = document.createElement("div");
    actions.className = "glossary-item-actions";
    const savedDate = document.createElement("small");
    savedDate.className = "saved-date";
    const date = new Date(item.savedAt);
    savedDate.textContent = "Disimpan: " +
      (Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("id-ID"));
    const deleteButton = document.createElement("button");
    deleteButton.className = "glossary-delete";
    deleteButton.textContent = "Hapus";
    deleteButton.addEventListener("click", () => onDelete(item, deleteButton));
    actions.append(savedDate, deleteButton);
    detail.appendChild(actions);
    glossaryItem.appendChild(detail);
    elements.glossaryList.appendChild(glossaryItem);
  });
}
export function initializeGlossaryUI({ onOpen, onSearch, onDelete }) {
  elements.glossaryBtn.addEventListener("click", async () => {
    elements.searchSection.hidden = true;
    elements.resultSection.hidden = true;
    elements.searchHistorySection.hidden = true;
    elements.popupContainer.classList.remove("history-open");
    elements.glossarySection.hidden = false;
    elements.popupContainer.classList.add("glossary-open");
    elements.glossarySearch.value = "";
    await onOpen();
  });

  elements.backBtn.addEventListener("click", () => {
    elements.glossarySection.hidden = true;
    elements.popupContainer.classList.remove("glossary-open");
    elements.popupContainer.classList.remove("history-open");
    elements.searchSection.hidden = false;
    elements.resultSection.hidden = false;
  });

  elements.glossarySearch.addEventListener("input", onSearch);
  elements.generalCategoryBtn.addEventListener("click", () => {
    activeGlossaryCategory = "general";
    elements.generalCategoryBtn.setAttribute("aria-pressed", "true");
    elements.programmingCategoryBtn.setAttribute("aria-pressed", "false");
    onSearch();
  });
  elements.programmingCategoryBtn.addEventListener("click", () => {
    activeGlossaryCategory = "programming";
    elements.generalCategoryBtn.setAttribute("aria-pressed", "false");
    elements.programmingCategoryBtn.setAttribute("aria-pressed", "true");
    onSearch();
  });

  return {
    render: (items) => renderGlossary(items, onDelete),
    showLoadError(error) {
      console.error("Load Glossary Error:", error);
      if (error instanceof InvalidGlossaryDataError) {
        elements.glossaryList.replaceChildren();
        elements.glossaryCount.textContent = "";
        elements.glossaryEmpty.hidden = true;
        elements.glossaryNoResults.hidden = true;
        elements.glossaryDataWarning.hidden = false;
        elements.glossaryDataWarning.textContent =
          "Format data Glosarium tidak dapat dibaca. Data tersimpan tidak diubah.";
        return;
      }
      alert("Gagal memuat Glosarium Saya.");
    },
  };
}



