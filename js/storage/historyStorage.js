const SEARCH_HISTORY_LIMIT = 10;
let searchHistoryQueue = Promise.resolve();

function isValidSearchHistoryItem(item) {
  return Boolean(
    item &&
    typeof item === "object" &&
    !Array.isArray(item) &&
    typeof item.term === "string" &&
    item.term.trim(),
  );
}

function queueHistoryOperation(operation) {
  searchHistoryQueue = searchHistoryQueue.catch(() => {}).then(operation);
  return searchHistoryQueue;
}

export async function readSearchHistory() {
  const data = await chrome.storage.local.get("searchHistory");
  if (data.searchHistory === undefined) return [];
  if (!Array.isArray(data.searchHistory)) {
    throw new Error("Format riwayat pencarian tidak valid.");
  }
  return data.searchHistory.filter(isValidSearchHistoryItem).slice(0, SEARCH_HISTORY_LIMIT);
}

export function loadSearchHistory() {
  return queueHistoryOperation(() => readSearchHistory());
}

export function recordSearchHistory(term) {
  return queueHistoryOperation(async () => {
    const history = await readSearchHistory();
    const normalizedTerm = term.trim().toLocaleLowerCase();
    const updatedHistory = [
      { term: term.trim(), searchedAt: new Date().toISOString() },
      ...history.filter((item) => item.term.trim().toLocaleLowerCase() !== normalizedTerm),
    ].slice(0, SEARCH_HISTORY_LIMIT);

    await chrome.storage.local.set({ searchHistory: updatedHistory });
    return updatedHistory;
  });
}


export function removeSearchHistoryTerm(term) {
  return queueHistoryOperation(async () => {
    const normalizedTerm = term.trim().toLocaleLowerCase();
    const history = await readSearchHistory();
    const updatedHistory = history.filter(
      (item) => item.term.trim().toLocaleLowerCase() !== normalizedTerm,
    );
    await chrome.storage.local.set({ searchHistory: updatedHistory });
    return updatedHistory;
  });
}
export function clearSearchHistory() {
  return queueHistoryOperation(async () => {
    await chrome.storage.local.set({ searchHistory: [] });
    return [];
  });
}