const MAX_TERM_LENGTH = 80;
const MAX_TERM_WORDS = 5;

let enabled = false;
let lastTerm = "";
let lastRange = null;
let selectionTimer = 0;
let buttonHost = null;
let buttonShadow = null;
let shadowStyle = null;
let searchPending = false;
let lookupVersion = 0;

function cleanTerm(rawValue) {
  if (typeof rawValue !== "string" || /[\r\n]/.test(rawValue)) return "";
  const term = rawValue.trim().replace(/\s+/g, " ");
  if (!term || term.length > MAX_TERM_LENGTH || term.split(" ").length > MAX_TERM_WORDS) return "";
  return term;
}

function removeFloatingUI() {
  lookupVersion += 1;
  buttonHost?.remove();
  buttonHost = null;
  buttonShadow = null;
  shadowStyle = null;
  lastTerm = "";
  lastRange = null;
  searchPending = false;
}

function positionFloatingUI() {
  if (!buttonHost || !lastRange) return;
  const rect = lastRange.getBoundingClientRect();
  const box = buttonHost.getBoundingClientRect();
  const edge = 8;
  const gap = 8;
  let top = rect.bottom + gap;
  if (top + box.height > window.innerHeight - edge) {
    top = rect.top - box.height - gap;
  }
  top = Math.max(edge, Math.min(top, window.innerHeight - box.height - edge));
  let left = rect.left + (rect.width - box.width) / 2;
  left = Math.max(edge, Math.min(left, window.innerWidth - box.width - edge));
  buttonHost.style.top = Math.round(top) + "px";
  buttonHost.style.left = Math.round(left) + "px";
}

function ensureHost() {
  if (buttonHost) return;
  buttonHost = document.createElement("div");
  buttonHost.setAttribute("aria-label", "Knowbyte Quick Definition");
  buttonHost.style.cssText =
    "all:initial;position:fixed;top:0;left:0;z-index:2147483647;display:block;width:max-content;height:max-content;pointer-events:auto;";
  buttonShadow = buttonHost.attachShadow({ mode: "closed" });
  shadowStyle = document.createElement("style");
  shadowStyle.textContent =
    "@keyframes pk-pop{from{opacity:0;transform:translateY(4px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}" +
    ".action{all:unset;box-sizing:border-box;display:flex;align-items:center;white-space:nowrap;min-height:34px;padding:7px 12px;border:1px solid #d98fa4;border-radius:999px;background:#f5c6d0;color:#754653;box-shadow:0 4px 14px rgba(117,70,83,.2);font:600 12px/1.2 Arial,sans-serif;cursor:pointer;animation:pk-pop .16s ease-out}" +
    ".action:hover{background:#fff8f3}.action:focus-visible,.close:focus-visible,.tab:focus-visible{outline:2px solid #a8bfa5;outline-offset:2px}.action:disabled{opacity:.7;cursor:wait}" +
    ".panel{box-sizing:border-box;width:100%;max-height:calc(100vh - 16px);overflow:auto;padding:12px;border:1px solid #f5c6d0;border-radius:14px;background:#fff8f3;color:#754653;box-shadow:0 8px 24px rgba(70,48,55,.2);font:13px/1.45 Arial,sans-serif;animation:pk-pop .16s ease-out}" +
    ".head{display:flex;align-items:center;gap:8px;margin-bottom:9px}.term{flex:1;min-width:0;font-size:16px;overflow-wrap:anywhere}" +
    ".close{flex:none;width:26px;height:26px;border:0;border-radius:8px;background:transparent;color:#754653;font:20px/1 Arial,sans-serif;cursor:pointer}" +
    ".tabs{display:flex;gap:4px;padding:3px;margin-bottom:9px;border-radius:10px;background:#f5e5e5}.tab{flex:1;border:0;border-radius:8px;padding:6px 8px;background:transparent;color:#754653;font:600 11px Arial,sans-serif;cursor:pointer}.tab[aria-selected=true]{background:#a8bfa5;color:#263a28}" +
    ".category{margin:0 0 5px;color:#617c60;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}" +
    ".definition{margin:0;font-size:13px;overflow-wrap:anywhere}.translation{margin:8px 0 0;padding-top:7px;border-top:1px solid #f1d7dc;color:#617c60;font-size:12px;overflow-wrap:anywhere}.translation-label{font-weight:700}" +
    ".program-entry+.program-entry{margin-top:10px;padding-top:9px;border-top:1px solid #f1d7dc}.simple{margin:6px 0 0;color:#617c60;font-size:12px;overflow-wrap:anywhere}" +
    ".state{margin:0;padding:5px 1px}.state-detail{display:block;margin-top:4px;color:#8a6b71;font-size:11px}";
  buttonShadow.appendChild(shadowStyle);
  (document.body || document.documentElement).appendChild(buttonHost);
}

function createCloseButton(onClick) {
  const close = document.createElement("button");
  close.type = "button";
  close.className = "close";
  close.setAttribute("aria-label", "Tutup definisi");
  close.textContent = "×";
  close.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  close.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return close;
}

function showActionButton(term) {
  ensureHost();
  buttonHost.style.width = "max-content";
  buttonShadow.querySelector(".action")?.remove();
  const button = document.createElement("button");
  button.className = "action";
  button.type = "button";
  button.textContent = "Lihat arti";
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    lookupDefinition(term);
  });
  buttonShadow.appendChild(button);
  positionFloatingUI();
}

function createPanel(term) {
  ensureHost();
  buttonHost.style.width = Math.max(0, Math.min(340, window.innerWidth - 16)) + "px";
  const panel = document.createElement("section");
  panel.className = "panel";
  const head = document.createElement("header");
  head.className = "head";
  const title = document.createElement("strong");
  title.className = "term";
  title.textContent = term;
  head.append(title, createCloseButton(removeFloatingUI));
  panel.appendChild(head);
  buttonShadow.replaceChildren(shadowStyle, panel);
  return panel;
}

function showState(term, message, detail = "") {
  const panel = createPanel(term);
  const state = document.createElement("p");
  state.className = "state";
  state.textContent = message;
  if (detail) {
    const hint = document.createElement("small");
    hint.className = "state-detail";
    hint.textContent = detail;
    state.appendChild(hint);
  }
  panel.appendChild(state);
  positionFloatingUI();
}

function appendGeneralMeaning(container, general, translationUnavailable) {
  const category = document.createElement("p");
  category.className = "category";
  category.textContent = "General";
  const definition = document.createElement("p");
  definition.className = "definition";
  definition.textContent = general.definition || "Definisi tidak tersedia.";
  container.append(category, definition);
  if (general.translation) {
    const translation = document.createElement("p");
    translation.className = "translation";
    const label = document.createElement("span");
    label.className = "translation-label";
    label.textContent = "Terjemahan: ";
    translation.append(label, document.createTextNode(general.translation));
    container.appendChild(translation);
  } else if (translationUnavailable) {
    const translation = document.createElement("p");
    translation.className = "translation";
    translation.textContent = "Terjemahan tidak tersedia saat ini.";
    container.appendChild(translation);
  }
}

function appendProgrammingMeanings(container, meanings) {
  meanings.forEach((meaning, index) => {
    const entry = document.createElement("article");
    entry.className = "program-entry";
    const category = document.createElement("p");
    category.className = "category";
    category.textContent = meaning.category || "Programming";
    const definition = document.createElement("p");
    definition.className = "definition";
    definition.textContent = meaning.definition || "Definisi tidak tersedia.";
    entry.append(category, definition);
    if (meaning.simpleExplanation && meaning.simpleExplanation !== meaning.definition) {
      const simple = document.createElement("p");
      simple.className = "simple";
      simple.textContent = meaning.simpleExplanation;
      entry.appendChild(simple);
    }
    if (meaning.sourceUrl) {
      const source = document.createElement("a");
      source.href = meaning.sourceUrl;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      source.textContent = meaning.sourceName || "Sumber";
      source.style.cssText = "display:inline-block;margin-top:6px;color:#617c60;font-size:11px";
      entry.appendChild(source);
    }
    if (index === 0) entry.style.marginTop = "0";
    container.appendChild(entry);
  });
}

function showDefinition(term, result, translationUnavailable) {
  const currentWord = result?.currentWord;
  if (!currentWord) {
    showState(term, "Definisi tidak dapat dibaca.", "Coba cari istilah ini lagi.");
    return;
  }
  const general = currentWord.generalMeaning;
  const programming = Array.isArray(currentWord.programmingMeaning)
    ? currentWord.programmingMeaning
    : currentWord.programmingMeaning
      ? [currentWord.programmingMeaning]
      : [];
  const hasGeneral = Boolean(general?.definition);
  const hasProgramming = programming.length > 0;
  if (!hasGeneral && !hasProgramming) {
    showState(term, "Istilah belum ditemukan.", "Coba periksa ejaan atau cari istilah lain.");
    return;
  }

  const panel = createPanel(term);
  let activeCategory = hasGeneral ? "general" : "programming";
  let content = document.createElement("div");
  const renderCategory = (category) => {
    activeCategory = category;
    content.replaceChildren();
    if (category === "general" && hasGeneral) {
      appendGeneralMeaning(content, general, translationUnavailable);
    } else {
      appendProgrammingMeanings(content, programming);
    }
    panel.querySelectorAll(".tab").forEach((tab) => {
      tab.setAttribute("aria-selected", String(tab.dataset.category === activeCategory));
    });
  };

  if (hasGeneral && hasProgramming) {
    const tabs = document.createElement("div");
    tabs.className = "tabs";
    for (const [category, label] of [["general", "General"], ["programming", "Programming"]]) {
      const tab = document.createElement("button");
      tab.className = "tab";
      tab.type = "button";
      tab.dataset.category = category;
      tab.textContent = label;
      tab.setAttribute("aria-selected", String(category === activeCategory));
      tab.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      tab.addEventListener("click", (event) => {
        event.stopPropagation();
        renderCategory(category);
      });
      tabs.appendChild(tab);
    }
    panel.appendChild(tabs);
  }

  content.setAttribute("aria-live", "polite");
  panel.appendChild(content);
  renderCategory(activeCategory);
  positionFloatingUI();
}

async function lookupDefinition(term) {
  if (!enabled || searchPending || term !== lastTerm) return;
  searchPending = true;
  const requestVersion = ++lookupVersion;
  showState(term, "Mencari arti...", "Menghubungi sumber definisi.");
  try {
    const response = await chrome.runtime.sendMessage({
      type: "KNOWBYTE_QUICK_DEFINITION",
      term,
    });
    if (requestVersion !== lookupVersion || term !== lastTerm || !buttonHost) return;
    searchPending = false;
    if (response?.ok) {
      showDefinition(term, response.result, response.translationUnavailable);
      return;
    }
    const kind = response?.error?.kind;
    if (kind === "not-found") {
      showState(term, "Istilah belum ditemukan.", "Coba periksa ejaan atau cari istilah lain.");
    } else if (kind === "network" || kind === "timeout" || kind === "rate-limit" || kind === "service") {
      showState(term, "Pencarian belum berhasil.", "Periksa koneksi lalu coba lagi.");
    } else {
      showState(term, "Definisi tidak dapat dimuat.", "Coba lagi sebentar.");
    }
  } catch (error) {
    console.warn("Quick Definition lookup failed:", error);
    if (requestVersion !== lookupVersion || term !== lastTerm || !buttonHost) return;
    searchPending = false;
    showState(term, "Pencarian belum berhasil.", "Periksa koneksi lalu coba lagi.");
  }
}

function updateFromSelection() {
  if (!enabled) return;
  const selection = window.getSelection();
  const term = cleanTerm(selection?.toString() || "");
  if (!term || !selection?.rangeCount || selection.isCollapsed) {
    removeFloatingUI();
    return;
  }
  const range = selection.getRangeAt(0);
  if (!buttonHost || term !== lastTerm) {
    removeFloatingUI();
    lastTerm = term;
    lastRange = range.cloneRange();
    showActionButton(term);
  } else {
    lastRange = range.cloneRange();
    positionFloatingUI();
  }
}

function scheduleSelectionUpdate() {
  clearTimeout(selectionTimer);
  selectionTimer = window.setTimeout(updateFromSelection, 60);
}

function handleOutsidePointer(event) {
  if (!buttonHost) return;
  const path = event.composedPath?.() || [];
  if (path.includes(buttonHost)) return;
  removeFloatingUI();
}

function handleKeyDown(event) {
  if (event.key === "Escape") removeFloatingUI();
}

function setEnabled(value) {
  const nextEnabled = value === true;
  if (nextEnabled === enabled) return;
  enabled = nextEnabled;
  if (enabled) {
    document.addEventListener("selectionchange", scheduleSelectionUpdate);
    document.addEventListener("pointerdown", handleOutsidePointer, true);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", scheduleSelectionUpdate);
    window.addEventListener("scroll", scheduleSelectionUpdate, true);
    window.addEventListener("popstate", removeFloatingUI);
    window.addEventListener("hashchange", removeFloatingUI);
    window.addEventListener("pagehide", removeFloatingUI);
  } else {
    document.removeEventListener("selectionchange", scheduleSelectionUpdate);
    document.removeEventListener("pointerdown", handleOutsidePointer, true);
    document.removeEventListener("keydown", handleKeyDown, true);
    window.removeEventListener("resize", scheduleSelectionUpdate);
    window.removeEventListener("scroll", scheduleSelectionUpdate, true);
    window.removeEventListener("popstate", removeFloatingUI);
    window.removeEventListener("hashchange", removeFloatingUI);
    window.removeEventListener("pagehide", removeFloatingUI);
    clearTimeout(selectionTimer);
    removeFloatingUI();
  }
}

chrome.storage.local.get({ selectTextEnabled: true }, (settings) => {
  setEnabled(settings.selectTextEnabled !== false);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.selectTextEnabled) {
    setEnabled(changes.selectTextEnabled.newValue !== false);
  }
});

