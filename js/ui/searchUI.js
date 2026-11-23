const elements = {
  wordInput: document.getElementById("wordInput"),
  searchBtn: document.getElementById("searchBtn"),
  emptyState: document.getElementById("emptyState"),
  resultContent: document.getElementById("resultContent"),
  resultWord: document.getElementById("resultWord"),
  resultNotice: document.getElementById("resultNotice"),
  meaningTabs: document.getElementById("meaningTabs"),
  generalMeaningTab: document.getElementById("generalMeaningTab"),
  programmingMeaningTab: document.getElementById("programmingMeaningTab"),
  generalMeaningPanel: document.getElementById("generalMeaningPanel"),
  programmingMeaningPanel: document.getElementById("programmingMeaningPanel"),
  programmingMeaningSection: document.getElementById("programmingMeaningSection"),
  programmingMeaningList: document.getElementById("programmingMeaningList"),
  generalMeaningSection: document.getElementById("generalMeaningSection"),
  generalPartOfSpeech: document.getElementById("generalPartOfSpeech"),
  generalDefinition: document.getElementById("generalDefinition"),
  generalTranslation: document.getElementById("generalTranslation"),
  statusBadge: document.getElementById("statusBadge"),
  searchHistoryCount: document.getElementById("searchHistoryCount"),
  searchHistoryList: document.getElementById("searchHistoryList"),
  searchHistoryEmpty: document.getElementById("searchHistoryEmpty"),
  searchHistoryStatus: document.getElementById("searchHistoryStatus"),
  clearSearchHistoryBtn: document.getElementById("clearSearchHistoryBtn"),
  historyBtn: document.getElementById("historyBtn"),
  backHistoryBtn: document.getElementById("backHistoryBtn"),
  searchHistorySection: document.getElementById("searchHistorySection"),
  popupContainer: document.querySelector(".container"),
  searchSection: document.querySelector(".search-section"),
  resultSection: document.getElementById("resultSection"),
};

function setEmptyMessage(title, detail, status) {
  elements.emptyState.hidden = false;
  elements.emptyState.querySelector("p").textContent = title;
  elements.emptyState.querySelector("small").textContent = detail;
  elements.statusBadge.textContent = status;
}

function renderSearchResult(currentWord, state) {
  const general = currentWord.generalMeaning;
  const programming = Array.isArray(currentWord.programmingMeaning)
    ? currentWord.programmingMeaning
    : currentWord.programmingMeaning && typeof currentWord.programmingMeaning === "object"
      ? [currentWord.programmingMeaning]
      : [];

  elements.resultWord.textContent = currentWord.word;
  const hasGeneral = Boolean(general);
  const hasProgramming = programming.length > 0;
  elements.meaningTabs.hidden = !(hasGeneral && hasProgramming);
  elements.generalMeaningTab.hidden = !hasGeneral;
  elements.programmingMeaningTab.hidden = !hasProgramming;

  function selectMeaningTab(tab) {
    const showProgramming = tab === "programming" && hasProgramming;
    const activeTab = showProgramming ? "programming" : "general";
    elements.generalMeaningTab.setAttribute("aria-selected", String(activeTab === "general"));
    elements.programmingMeaningTab.setAttribute("aria-selected", String(activeTab === "programming"));
    elements.generalMeaningTab.tabIndex = activeTab === "general" ? 0 : -1;
    elements.programmingMeaningTab.tabIndex = activeTab === "programming" ? 0 : -1;
    elements.generalMeaningPanel.hidden = activeTab !== "general" || !hasGeneral;
    elements.programmingMeaningPanel.hidden = activeTab !== "programming" || !hasProgramming;
  }

  selectMeaningTab(hasProgramming ? "programming" : "general");
  elements.programmingMeaningList.replaceChildren();
  programming.forEach((meaning) => {
    const entry = document.createElement("article");
    entry.className = "programming-meaning-entry";

    const heading = document.createElement("div");
    heading.className = "meaning-card-heading";
    const term = document.createElement("strong");
    term.className = "programming-meaning-term";
    term.textContent = meaning.term;
    const category = document.createElement("span");
    category.className = "meaning-category";
    category.textContent = meaning.category;
    heading.append(term, category);
    entry.appendChild(heading);

    const definition = document.createElement("p");
    definition.className = "meaning-definition";
    definition.textContent = meaning.definition;
    entry.appendChild(definition);

    if (meaning.simpleExplanation) {
      const explanation = document.createElement("p");
      explanation.className = "meaning-explanation";
      explanation.textContent = meaning.simpleExplanation;
      entry.appendChild(explanation);
    }

    if (meaning.sourceUrl) {
      const source = document.createElement("a");
      source.className = "meaning-source";
      source.href = meaning.sourceUrl;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      source.textContent = meaning.sourceName || "Sumber";
      entry.appendChild(source);
    }
    elements.programmingMeaningList.appendChild(entry);
  });

  if (general) {
    elements.generalPartOfSpeech.textContent = general.partOfSpeech || "";
    elements.generalPartOfSpeech.hidden = !general.partOfSpeech;
    elements.generalDefinition.textContent = general.definition;
    elements.generalTranslation.textContent = general.translation
      ? `Terjemahan: ${general.translation}`
      : "Terjemahan sementara tidak tersedia.";
  }

  elements.generalMeaningTab.onclick = () => selectMeaningTab("general");
  elements.programmingMeaningTab.onclick = () => selectMeaningTab("programming");
  [elements.generalMeaningTab, elements.programmingMeaningTab].forEach((tab) => {
    tab.onkeydown = (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const nextTab = tab === elements.generalMeaningTab
        ? elements.programmingMeaningTab
        : elements.generalMeaningTab;
      if (!nextTab.hidden) {
        selectMeaningTab(nextTab === elements.programmingMeaningTab ? "programming" : "general");
        nextTab.focus();
      }
    };
  });

  if (state.lookupErrors.length || state.programmingContextsLimited) {
    elements.resultNotice.textContent = state.lookupErrors.length
      ? "Sebagian sumber belum dapat dimuat. Hasil yang tersedia tetap ditampilkan."
      : "Tiga konteks paling relevan ditampilkan agar hasil tetap ringkas.";
    elements.resultNotice.hidden = false;
  } else {
    elements.resultNotice.hidden = true;
  }

  elements.emptyState.hidden = true;
  elements.resultContent.hidden = false;
  elements.statusBadge.textContent = state.lookupErrors.length
    ? "Hasil sebagian"
    : state.programmingContextsLimited
      ? "Konteks diringkas"
      : state.translationUnavailable
        ? "Ditemukan Â· tanpa terjemahan"
        : "Ditemukan";
}

function renderSearchHistory(history, onSelectTerm, onDeleteTerm) {
  elements.searchHistoryCount.textContent = history.length;
  elements.searchHistoryList.replaceChildren();
  elements.searchHistoryEmpty.hidden = history.length > 0;
  elements.clearSearchHistoryBtn.disabled = history.length === 0;

  history.forEach((item) => {
    const row = document.createElement("li");
    row.className = "search-history-item";
    const searchButton = document.createElement("button");
    searchButton.type = "button";
    searchButton.className = "search-history-search";
    searchButton.setAttribute("aria-label", "Cari lagi: " + item.term);
    const term = document.createElement("span");
    term.className = "search-history-term";
    term.textContent = item.term;
    searchButton.appendChild(term);

    if (item.searchedAt) {
      const date = new Date(item.searchedAt);
      if (!Number.isNaN(date.getTime())) {
        const dateLabel = document.createElement("small");
        dateLabel.className = "search-history-date";
        dateLabel.textContent = date.toLocaleDateString("id-ID");
        searchButton.appendChild(dateLabel);
      }
    }

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-history-item";
    deleteButton.setAttribute("aria-label", "Hapus " + item.term + " dari riwayat");
    deleteButton.textContent = "Hapus";
    deleteButton.addEventListener("click", () => onDeleteTerm(item.term));
    searchButton.addEventListener("click", () => {
      elements.searchHistorySection.hidden = true;
      elements.popupContainer.classList.remove("history-open");
      elements.searchSection.hidden = false;
      elements.resultSection.hidden = false;
      onSelectTerm(item.term);
    });
    row.append(searchButton, deleteButton);
    elements.searchHistoryList.appendChild(row);
  });
}
export function initializeSearchUI({ onSearch, onHistorySearch, onClearHistory, onDeleteHistory }) {
  elements.searchBtn.addEventListener("click", onSearch);
  elements.historyBtn.addEventListener("click", () => {
    elements.searchSection.hidden = true;
    elements.resultSection.hidden = true;
    elements.searchHistorySection.hidden = false;
    elements.popupContainer.classList.add("history-open");
  });
  elements.backHistoryBtn.addEventListener("click", () => {
    elements.searchHistorySection.hidden = true;
    elements.popupContainer.classList.remove("history-open");
    elements.searchSection.hidden = false;
    elements.resultSection.hidden = false;
  });
  elements.wordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") onSearch();
  });
  elements.clearSearchHistoryBtn.addEventListener("click", async () => {
    if (!window.confirm("Hapus semua riwayat pencarian?")) return;
    elements.clearSearchHistoryBtn.disabled = true;
    await onClearHistory();
  });

  return {
    getSearchTerm: () => elements.wordInput.value.trim(),
    setSearchTerm: (term) => { elements.wordInput.value = term; },
    setBusy(isBusy) {
      elements.searchBtn.disabled = isBusy;
      elements.searchBtn.textContent = isBusy ? "Mencari..." : "Cari";
    },
    showSearching() {
      elements.resultContent.hidden = true;
      elements.statusBadge.textContent = "Sedang mencari";
      setEmptyMessage("Sedang mencari istilah...", "Mohon tunggu sebentar.", "Sedang mencari");
    },
    showRequiredTerm() {
      elements.resultContent.hidden = true;
      setEmptyMessage(
        "Masukkan istilah terlebih dahulu.",
        "Ketik istilah pada kolom pencarian.",
        "Perlu istilah",
      );
    },
    renderResult: renderSearchResult,
    showSearchError(error) {
      elements.resultContent.hidden = true;
      if (error.kind === "not-found") {
        setEmptyMessage("Istilah belum ditemukan.", "Periksa ejaan istilah atau coba istilah lain.", "Tidak ditemukan");
      } else if (error.kind === "timeout") {
        setEmptyMessage("Pencarian memerlukan waktu terlalu lama.", "Coba lagi sebentar.", "Waktu habis");
      } else if (error.kind === "rate-limit") {
        setEmptyMessage("Permintaan pencarian sedang dibatasi.", "Tunggu sebentar sebelum mencoba lagi.", "Tunggu sebentar");
      } else if (error.kind === "network" || error.kind === "service") {
        setEmptyMessage("Layanan kamus sedang tidak tersedia.", "Periksa koneksi internet atau coba lagi nanti.", "Layanan terganggu");
      } else {
        setEmptyMessage("Hasil pencarian tidak dapat dibaca.", "Coba cari istilah ini lagi.", "Terjadi kendala");
      }
      console.error("Search Error:", error);
    },
    renderHistory(history) {
      renderSearchHistory(history, onHistorySearch, onDeleteHistory);
    },
    showHistoryError(error) {
      console.warn("Search history error:", error);
      elements.searchHistoryStatus.textContent = "Riwayat pencarian tidak dapat diperbarui.";
      elements.searchHistoryStatus.hidden = false;
      elements.clearSearchHistoryBtn.disabled = false;
    },
    showUnsupportedPage() {
      elements.resultContent.hidden = true;
      elements.emptyState.hidden = false;
      elements.emptyState.querySelector("p").textContent = "Halaman ini tidak didukung.";
      elements.emptyState.querySelector("small").textContent =
        "Coba di situs web lain yang mendukung Select & Click.";
    },
    clearHistoryStatus() {
      elements.searchHistoryStatus.hidden = true;
    },
  };
}