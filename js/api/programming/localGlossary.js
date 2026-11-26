let glossaryPromise = null;

//sumber istilah programming//
function sourceNameFor(url) {
  if (typeof url !== "string") return "Dokumentasi";
  if (url.includes("developer.mozilla.org")) return "MDN Web Docs";
  if (url.includes("docs.python.org")) return "Dokumentasi Python";
  if (url.includes("php.net")) return "PHP Manual";
  if (url.includes("docs.oracle.com")) return "Dokumentasi Java";
  if (url.includes("learn.microsoft.com")) return "Microsoft Learn";
  if (url.includes("postgresql.org")) return "Dokumentasi PostgreSQL";
  return "Dokumentasi";
}

export function normalizeTerm(value) {
  return typeof value === "string"
    ? value.trim().toLocaleLowerCase("en").replace(/[\s_-]+/g, " ")
    : "";
}

function loadGlossary() {
  if (!glossaryPromise) {
    glossaryPromise = fetch(chrome.runtime.getURL("data/programming-glossary.json"))
      .then((response) => {
        if (!response.ok) throw new Error(`Glossary JSON returned ${response.status}.`);
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data?.terms)) throw new Error("Glossary JSON has an invalid format.");
        return data.terms;
      })
      .catch((error) => {
        glossaryPromise = null;
        throw error;
      });
  }
  return glossaryPromise;
}

export async function lookupLocalProgrammingMeanings(word) {
  const terms = await loadGlossary();
  const query = word.trim();
  const normalizedWord = normalizeTerm(word);

  return terms.filter((item) => {
    if (!item || typeof item.term !== "string" || typeof item.definition !== "string") return false;
    return [item.term, ...(Array.isArray(item.aliases) ? item.aliases : [])]
      .some((candidate) => item.caseSensitive
        ? typeof candidate === "string" && candidate.trim() === query
        : normalizeTerm(candidate) === normalizedWord);
  }).map((item) => ({ ...item, sourceName: item.sourceName || sourceNameFor(item.sourceUrl) }));
}
