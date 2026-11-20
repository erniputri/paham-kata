export class SearchError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = "SearchError";
    this.kind = kind;
  }
}

export async function fetchJsonWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return { response, data: null };

    try {
      return { response, data: await response.json() };
    } catch {
      throw new SearchError("invalid-response", "Respons API bukan JSON yang valid.");
    }
  } catch (error) {
    if (error instanceof SearchError) throw error;
    if (error.name === "AbortError") {
      throw new SearchError("timeout", "Request API melewati batas waktu.");
    }
    throw new SearchError("network", "Tidak dapat terhubung ke layanan API.");
  } finally {
    clearTimeout(timeoutId);
  }
}
// API (arti kata umum dalam bahasa inggris)
export async function lookupGeneralMeaning(word) {
  const { response, data } = await fetchJsonWithTimeout(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
  );
  if (response.status === 404) return null;
  if (response.status === 429) {
    throw new SearchError("rate-limit", "Dictionary API membatasi jumlah permintaan.");
  }
  if (!response.ok) {
    throw new SearchError("service", `Dictionary API mengembalikan ${response.status}.`);
  }
  if (!Array.isArray(data)) {
    throw new SearchError("invalid-response", "Struktur respons kamus tidak valid.");
  }

  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    for (const meaning of Array.isArray(entry.meanings) ? entry.meanings : []) {
      for (const definition of Array.isArray(meaning?.definitions) ? meaning.definitions : []) {
        if (typeof definition?.definition === "string" && definition.definition.trim()) {
          return {
            word: typeof entry.word === "string" && entry.word.trim() ? entry.word : word,
            partOfSpeech: typeof meaning.partOfSpeech === "string" ? meaning.partOfSpeech : "",
            definition: definition.definition.trim(),
            sourceUrl: "https://dictionaryapi.dev/",
          };
        }
      }
    }
  }
  return null;
}
