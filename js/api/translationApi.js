import { fetchJsonWithTimeout, SearchError } from "./dictionaryApi.js";

// API (bahasa inggris ke indonesia)
export async function translateDefinition(definition) {
  const { response, data } = await fetchJsonWithTimeout(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(definition)}&langpair=en|id`,
  );
  if (!response.ok) {
    throw new SearchError("translation", `MyMemory mengembalikan ${response.status}.`);
  }

  const translatedText = data?.responseData?.translatedText;
  if (
    Number(data?.responseStatus) !== 200 ||
    typeof translatedText !== "string" ||
    !translatedText.trim()
  ) {
    throw new SearchError("translation", "Respons MyMemory tidak memuat terjemahan valid.");
  }
  return translatedText.trim();
}
