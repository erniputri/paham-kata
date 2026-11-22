import { fetchJsonWithTimeout, SearchError } from "../dictionaryApi.js";

const TECHNICAL_SUMMARY = /\b(comput\w*|program\w*|software|code|coding|algorithm\w*|data structure|database|web|internet|network|http|javascript|python|php|java|function\w*|runtime|framework|application|perangkat lunak|pemrograman|komputer|jaringan|basis data|aplikasi|fungsi|algoritma|sistem operasi)\b/i;

function normalizeTitle(value) {
  return typeof value === "string" ? value.replace(/_/g, " ").trim().toLowerCase() : "";
}

export async function lookupWikipediaSummary(title, language) {
  if (!title || !["en", "id"].includes(language)) return null;
  const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
  url.search = new URLSearchParams({
    action: "query", format: "json", origin: "*", prop: "extracts",
    exintro: "1", explaintext: "1", exsentences: "2", titles: title,
  });
  const { response, data } = await fetchJsonWithTimeout(url, 7000);
  if (response.status === 429) {
    throw new SearchError("rate-limit", "Wikipedia membatasi jumlah permintaan.");
  }
  if (!response.ok) throw new SearchError("service", `Wikipedia mengembalikan ${response.status}.`);
  const pages = data?.query?.pages;
  if (!pages || typeof pages !== "object") {
    throw new SearchError("invalid-response", "Respons Wikipedia tidak valid.");
  }
  const page = Object.values(pages).find((item) => typeof item?.extract === "string");
  if (!page?.extract.trim() || normalizeTitle(page.title) !== normalizeTitle(title)) return null;
  const text = page.extract.replace(/\s+/g, " ").trim();
  if (text.length < 20 || /\b(disambiguation|disambiguasi)\b/i.test(page.title) ||
      !TECHNICAL_SUMMARY.test(text.slice(0, 300))) return null;
  return {
    text: text.slice(0, 450),
    sourceUrl: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    language,
  };
}
