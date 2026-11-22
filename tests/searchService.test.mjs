import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { searchMeanings } from "../js/services/searchService.js";

const glossary = JSON.parse(await readFile(new URL("../data/programming-glossary.json", import.meta.url)));
globalThis.chrome = { runtime: { getURL: () => "chrome-extension://test/data/programming-glossary.json" } };

function response(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

test("general meaning and translation keep working alongside local programming fallback", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.startsWith("chrome-extension:")) return response(glossary);
    if (value.includes("dictionaryapi.dev")) return response([{ word: "class", meanings: [
      { partOfSpeech: "noun", definitions: [{ definition: "A group of students." }] },
    ] }]);
    if (value.includes("mymemory")) return response({ responseStatus: 200, responseData: {
      translatedText: "Sekelompok murid.",
    } });
    if (value.includes("wikidata")) return response({ search: [] });
    throw new Error(`Unexpected request: ${value}`);
  };
  const result = await searchMeanings("class");
  assert.equal(result.currentWord.generalMeaning.translation, "Sekelompok murid.");
  assert.equal(result.currentWord.programmingMeaning.length, 3);
  assert.equal(result.currentWord.definition, "A group of students.");
});

test("unknown term reports not found when both sources have no match", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.startsWith("chrome-extension:")) return response(glossary);
    if (value.includes("dictionaryapi.dev")) return response(null, 404);
    if (value.includes("wikidata")) return response({ search: [] });
    throw new Error(`Unexpected request: ${value}`);
  };
  await assert.rejects(searchMeanings("no-such-tech-term-xyz"), { kind: "not-found" });
});
