// Manual network smoke test: node tests/liveProgrammingLookup.mjs
import { readFile } from "node:fs/promises";
import { lookupProgrammingMeanings } from "../js/api/programming/programmingLookup.js";

const glossary = JSON.parse(await readFile(new URL("../data/programming-glossary.json", import.meta.url)));
const networkFetch = globalThis.fetch;
globalThis.chrome = { runtime: { getURL: () => "chrome-extension://test/data/programming-glossary.json" } };
globalThis.fetch = (url, options) => String(url).startsWith("chrome-extension:")
  ? Promise.resolve({ ok: true, json: async () => glossary })
  : networkFetch(url, options);

const terms = process.argv.slice(2);
for (const term of terms.length ? terms : ["middleware", "dependency injection", "class", "GET", "notarealprogrammingtermxyz"]) {
  const result = await lookupProgrammingMeanings(term);
  console.log(JSON.stringify({
    term,
    meanings: result.meanings.map((meaning) => ({
      category: meaning.category,
      definition: meaning.definition.slice(0, 160),
      sourceName: meaning.sourceName,
    })),
    errors: result.lookupErrors.map((error) => error.kind || error.message),
  }));
}
