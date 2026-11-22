import { fetchJsonWithTimeout, SearchError } from "../dictionaryApi.js";
import { normalizeTerm } from "./localGlossary.js";

const TECHNICAL_CONTEXT = /\b(comput\w*|program\w*|software|code|coding|developer|algorithm\w*|data structure|database|web|internet|network|http|javascript|python|php|java language|object.oriented|function\w*|runtime|framework|application programming|information technology|operating system|digital|class in|machine learning)\b/i;
const EXCLUDED_CONTEXT = /\b(film|novel|book|album|song|musician|company|surname|city|village|journal|patent|television|comic|video game|species|taxonomic|educat|school|university|politic|person|birth)\b/i;
const MAX_CANDIDATES = 10;
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_LIMIT = 30;
const RATE_LIMIT_KEY = "wikidataRateLimitedUntil";
const conceptCache = new Map();
let rateLimitedUntil = 0;

async function getRateLimitUntil() {
  if (!chrome.storage?.session) return rateLimitedUntil;
  try {
    const stored = await chrome.storage.session.get(RATE_LIMIT_KEY);
    rateLimitedUntil = Math.max(rateLimitedUntil, Number(stored[RATE_LIMIT_KEY]) || 0);
  } catch (error) {
    console.warn("Wikidata cooldown could not be read:", error);
  }
  return rateLimitedUntil;
}

function matchesTerm(candidate, query) {
  if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(candidate.label) &&
      candidate.label !== query.trim()) return false;
  const label = normalizeTerm(candidate.label);
  const normalizedQuery = normalizeTerm(query);
  if (label === normalizedQuery) return true;
  if (label.startsWith(`${normalizedQuery} (`)) return true;
  return Array.isArray(candidate.aliases) && candidate.aliases.some(
    (alias) => normalizeTerm(alias) === normalizedQuery,
  );
}

function scoreCandidate(candidate, query) {
  const description = typeof candidate.description === "string" ? candidate.description : "";
  if (!description || EXCLUDED_CONTEXT.test(description) || !TECHNICAL_CONTEXT.test(description)) return -1;
  if (!matchesTerm(candidate, query)) return -1;
  const label = normalizeTerm(candidate.label);
  const normalizedQuery = normalizeTerm(query);
  return (label === normalizedQuery ? 10 : 0) +
    (/\b(program\w*|software|comput\w*|code|data structure)\b/i.test(description) ? 3 : 0);
}

async function fetchWikidata(url) {
  if (Date.now() < rateLimitedUntil) {
    throw new SearchError("rate-limit", "Wikidata membatasi jumlah permintaan.");
  }
  const { response, data } = await fetchJsonWithTimeout(url, 7000);
  if (response.status === 429) {
    rateLimitedUntil = Date.now() + 60 * 1000;
    chrome.storage?.session?.set({ [RATE_LIMIT_KEY]: rateLimitedUntil }).catch((error) => {
      console.warn("Wikidata cooldown could not be saved:", error);
    });
    throw new SearchError("rate-limit", "Wikidata membatasi jumlah permintaan.");
  }
  if (!response.ok) throw new SearchError("service", `Wikidata mengembalikan ${response.status}.`);
  if (!data || typeof data !== "object" || data.error) {
    throw new SearchError("invalid-response", "Respons Wikidata tidak valid.");
  }
  return data;
}

async function fetchConcept(word) {
  const searchUrl = new URL("https://www.wikidata.org/w/api.php");
  searchUrl.search = new URLSearchParams({
    action: "wbsearchentities", format: "json", origin: "*",
    language: "en", type: "item", limit: String(MAX_CANDIDATES), search: word.trim(),
  });
  const data = await fetchWikidata(searchUrl);
  if (!Array.isArray(data.search)) {
    throw new SearchError("invalid-response", "Daftar hasil Wikidata tidak valid.");
  }
  const ranked = data.search
    .map((item) => ({ item, score: scoreCandidate(item, word) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;

  const candidate = ranked[0].item;
  if (!/^Q\d+$/.test(candidate.id)) return null;
  const detailUrl = new URL("https://www.wikidata.org/w/api.php");
  detailUrl.search = new URLSearchParams({
    action: "wbgetentities", format: "json", origin: "*", ids: candidate.id,
    props: "descriptions|sitelinks", languages: "id|en", sitefilter: "idwiki|enwiki",
  });
  try {
    const detail = await fetchWikidata(detailUrl);
    const entity = detail.entities?.[candidate.id];
    return {
      id: candidate.id,
      term: candidate.label,
      description: candidate.description,
      indonesianDescription: entity?.descriptions?.id?.value || "",
      indonesianTitle: entity?.sitelinks?.idwiki?.title || "",
      englishTitle: entity?.sitelinks?.enwiki?.title || "",
    };
  } catch (error) {
    // Deskripsi dari pencarian tetap valid jika detail Wikidata sementara gagal.
    return { id: candidate.id, term: candidate.label, description: candidate.description };
  }
}

export async function lookupWikidataConcept(word) {
  const key = word.trim();
  const cached = conceptCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  conceptCache.delete(key);
  if (Date.now() < await getRateLimitUntil()) {
    throw new SearchError("rate-limit", "Wikidata membatasi jumlah permintaan.");
  }
  const value = await fetchConcept(key);
  conceptCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  if (conceptCache.size > CACHE_LIMIT) conceptCache.delete(conceptCache.keys().next().value);
  return value;
}
