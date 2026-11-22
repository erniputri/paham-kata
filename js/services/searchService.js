import { lookupGeneralMeaning, SearchError } from "../api/dictionaryApi.js";
import { translateDefinition } from "../api/translationApi.js";
import { lookupProgrammingMeanings } from "../api/programming/programmingLookup.js";

const MAX_PROGRAMMING_CONTEXTS = 3;

export async function searchMeanings(word) {
  const [generalResult, programmingResult] = await Promise.allSettled([
    lookupGeneralMeaning(word),
    lookupProgrammingMeanings(word),
  ]);

  const generalMeaning = generalResult.status === "fulfilled" ? generalResult.value : null;
  const programmingLookup = programmingResult.status === "fulfilled"
    ? programmingResult.value
    : { meanings: [], contextsLimited: false, lookupErrors: [] };
  const programmingMeanings = programmingLookup.meanings;
  const lookupErrors = [generalResult, programmingResult]
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason)
    .concat(programmingLookup.lookupErrors);

  if (!generalMeaning && programmingMeanings.length === 0) {
    if (lookupErrors.length) throw lookupErrors[0];
    throw new SearchError("not-found", "Istilah tidak ditemukan.");
  }

  let translation = "";
  let translationUnavailable = false;
  if (generalMeaning) {
    try {
      translation = await translateDefinition(generalMeaning.definition);
    } catch (error) {
      translationUnavailable = true;
      console.warn("Translation unavailable:", error);
    }
  }

  const programmingData = programmingMeanings.slice(0, MAX_PROGRAMMING_CONTEXTS).map((meaning) => ({
    term: meaning.term,
    category: meaning.category || "Programming Concept",
    definition: meaning.definition,
    simpleExplanation: meaning.simpleExplanation || "",
    sourceName: meaning.sourceName || "Dokumentasi",
    sourceUrl: meaning.sourceUrl || "",
    caseSensitive: Boolean(meaning.caseSensitive),
  }));

  const wordToDisplay =
    programmingData.find((meaning) => meaning.caseSensitive)?.term ||
    generalMeaning?.word || programmingData[0]?.term || word;
  const generalData = generalMeaning ? { ...generalMeaning, translation } : null;

  return {
    currentWord: {
      word: wordToDisplay,
      // Field lama tetap disimpan agar data Glosarium terdahulu tetap terbaca.
      translation: generalData?.translation || "",
      definition: generalData?.definition || programmingData[0]?.definition || "",
      generalMeaning: generalData,
      programmingMeaning: programmingData,
    },
    lookupErrors,
    translationUnavailable,
    programmingContextsLimited: programmingLookup.contextsLimited,
  };
}
