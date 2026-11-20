import { lookupGeneralMeaning, SearchError } from "../api/dictionaryApi.js";
import { translateDefinition } from "../api/translationApi.js";

const MAX_PROGRAMMING_CONTEXTS = 3;
let programmingGlossaryPromise = null;

function normalizeTerm(value) {
  return typeof value === "string"
    ? value.trim().toLocaleLowerCase("en").replace(/[\s_-]+/g, " ")
    : "";
}

// JSON yang membaca arti programing
function loadProgrammingGlossary() {
  if (!programmingGlossaryPromise) {
    programmingGlossaryPromise = fetch(chrome.runtime.getURL("data/programming-glossary.json"))
      .then((response) => {
        if (!response.ok) throw new Error(`Glossary JSON returned ${response.status}.`);
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data?.terms)) throw new Error("Glossary JSON has an invalid format.");
        return data.terms;
      })
      .catch((error) => {
        programmingGlossaryPromise = null;
        throw error;
      });
  }
  return programmingGlossaryPromise;
}

async function lookupProgrammingMeanings(word) {
  const terms = await loadProgrammingGlossary();
  const query = word.trim();
  const normalizedWord = normalizeTerm(word);

  return terms.filter((item) => {
    if (!item || typeof item.term !== "string" || typeof item.definition !== "string") return false;
    return [item.term, ...(Array.isArray(item.aliases) ? item.aliases : [])]
      .some((candidate) => item.caseSensitive
        ? typeof candidate === "string" && candidate.trim() === query
        : normalizeTerm(candidate) === normalizedWord);
  });
}

export async function searchMeanings(word) {
  const [generalResult, programmingResult] = await Promise.allSettled([
    lookupGeneralMeaning(word),
    lookupProgrammingMeanings(word),
  ]);

  const generalMeaning = generalResult.status === "fulfilled" ? generalResult.value : null;
  const programmingMeanings = programmingResult.status === "fulfilled" ? programmingResult.value : [];
  const lookupErrors = [generalResult, programmingResult]
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason);

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
    programmingContextsLimited: programmingMeanings.length > programmingData.length,
  };
}
