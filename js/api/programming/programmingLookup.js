import { translateDefinition } from "../translationApi.js";
import { lookupLocalProgrammingMeanings, normalizeTerm } from "./localGlossary.js";
import { lookupWikidataConcept } from "./wikidataApi.js";
import { lookupWikipediaSummary } from "./wikipediaApi.js";

const MAX_PROGRAMMING_CONTEXTS = 3;

function categoryFor(description) {
  if (/\b(database|sql)\b/i.test(description)) return "Database";
  if (/\b(web|http|internet|network)\b/i.test(description)) return "Web / Jaringan";
  if (/\b(data structure|algorithm)\b/i.test(description)) return "Struktur Data / Algoritma";
  return "Konsep Pemrograman";
}

async function translateOrKeep(text) {
  if (!text) return "";
  try {
    return await translateDefinition(text);
  } catch (error) {
    console.warn("Programming translation unavailable:", error);
    return text;
  }
}

//penghubung utama antara wikidata & wikipedia//
async function buildExternalMeaning(word) {
  const concept = await lookupWikidataConcept(word);
  if (!concept) return null;

  let summary = null;
  if (concept.englishTitle) {
    try { summary = await lookupWikipediaSummary(concept.englishTitle, "en"); }
    catch (error) { console.warn("English Wikipedia unavailable:", error); }
  }
  if (!summary && concept.indonesianTitle) {
    try { summary = await lookupWikipediaSummary(concept.indonesianTitle, "id"); }
    catch (error) { console.warn("Indonesian Wikipedia unavailable:", error); }
  }

  const sourceText = summary?.text || concept.description;
  const definition = summary?.language === "id"
    ? sourceText
    : concept.indonesianDescription && !summary
      ? concept.indonesianDescription
      : await translateOrKeep(sourceText);
  if (!definition || definition.length < 8) return null;
  return {
    term: word.trim(),
    category: categoryFor(concept.description),
    definition,
    simpleExplanation: "",
    sourceName: summary
      ? "Kontributor Wikipedia · CC BY-SA (diringkas/diterjemahkan)"
      : "Wikidata",
    sourceUrl: summary?.sourceUrl || `https://www.wikidata.org/wiki/${concept.id}`,
    caseSensitive: false,
  };
}

export async function lookupProgrammingMeanings(word) {
  const [external, local] = await Promise.allSettled([
    buildExternalMeaning(word),
    lookupLocalProgrammingMeanings(word),
  ]);
  const lookupErrors = [];//mengumpulkan error//
  if (external.status === "rejected") lookupErrors.push(external.reason);
  if (local.status === "rejected") lookupErrors.push(local.reason);

  const localMeanings = local.status === "fulfilled" ? local.value : [];
  const externalMeaning = external.status === "fulfilled" ? external.value : null;
  const meanings = externalMeaning ? [externalMeaning] : [];
  const seen = new Set(meanings.map((item) => `${normalizeTerm(item.term)}|${item.category}`));
  for (const item of localMeanings) {
    const key = `${normalizeTerm(item.term)}|${item.category}`;
    if (!seen.has(key)) meanings.push(item);
    seen.add(key);
  }
  return {
    meanings: meanings.slice(0, MAX_PROGRAMMING_CONTEXTS),
    contextsLimited: meanings.length > MAX_PROGRAMMING_CONTEXTS,
    lookupErrors,
  };
}
