import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { lookupProgrammingMeanings } from "../js/api/programming/programmingLookup.js";
import { lookupWikipediaSummary } from "../js/api/programming/wikipediaApi.js";

const glossary = JSON.parse(await readFile(new URL("../data/programming-glossary.json", import.meta.url)));
globalThis.chrome = { runtime: { getURL: () => "chrome-extension://test/data/programming-glossary.json" } };

function jsonResponse(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

test("external concept is translated and shown before local definitions", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.startsWith("chrome-extension:")) return jsonResponse(glossary);
    if (value.includes("wbsearchentities")) return jsonResponse({ search: [
      { id: "Q635336", label: "dependency injection", description: "technique in software engineering" },
      { id: "Q2", label: "dependency injection", description: "2016 film" },
    ] });
    if (value.includes("wbgetentities")) return jsonResponse({ entities: { Q635336: {
      sitelinks: { enwiki: { title: "Dependency injection" } }, descriptions: {},
    } } });
    if (value.includes("wikipedia.org")) return jsonResponse({ query: { pages: {
      1: { title: "Dependency injection", extract: "A programming technique used in software engineering." },
    } } });
    if (value.includes("mymemory")) return jsonResponse({ responseStatus: 200, responseData: {
      translatedText: "Teknik pemrograman dalam rekayasa perangkat lunak.",
    } });
    throw new Error(`Unexpected request: ${value}`);
  };
  const result = await lookupProgrammingMeanings("dependency injection");
  assert.equal(result.meanings[0].definition, "Teknik pemrograman dalam rekayasa perangkat lunak.");
  assert.match(result.meanings[0].sourceUrl, /wikipedia.org/);
  assert.equal(result.lookupErrors.length, 0);
});

test("unrelated Wikipedia paragraph is rejected and Wikidata description is used", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.startsWith("chrome-extension:")) return jsonResponse(glossary);
    if (value.includes("wbsearchentities")) return jsonResponse({ search: [
      { id: "Q146768", label: "middleware", description: "computer software that provides services to applications" },
    ] });
    if (value.includes("wbgetentities")) return jsonResponse({ entities: { Q146768: {
      sitelinks: { enwiki: { title: "Middleware" } }, descriptions: {},
    } } });
    if (value.includes("wikipedia.org")) return jsonResponse({ query: { pages: {
      1: { title: "Middleware", extract: "Middleware is a 2016 film about a fictional detective." },
    } } });
    if (value.includes("mymemory")) return jsonResponse({ responseStatus: 200, responseData: {
      translatedText: "Perangkat lunak komputer yang menyediakan layanan bagi aplikasi.",
    } });
    throw new Error(`Unexpected request: ${value}`);
  };
  const result = await lookupProgrammingMeanings("middleware");
  assert.equal(result.meanings[0].definition, "Perangkat lunak komputer yang menyediakan layanan bagi aplikasi.");
  assert.equal(result.meanings[0].sourceName, "Wikidata");
});

test("Wikipedia response with a different title is rejected", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => jsonResponse({ query: { pages: {
    1: { title: "Middleware (film)", extract: "A programming concept in computer science with a different page title." },
  } } });
  assert.equal(await lookupWikipediaSummary("Middleware", "en"), null);
});

test("unrelated external results fall back to curated language contexts", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url) => String(url).startsWith("chrome-extension:")
    ? jsonResponse(glossary)
    : jsonResponse({ search: [{ id: "Q1", label: "class", description: "group of students in a school" }] });
  const result = await lookupProgrammingMeanings("class");
  assert.deepEqual(result.meanings.map((item) => item.category), ["JavaScript", "Java", "C#"]);
});

test("lowercase get does not inherit an uppercase HTTP result", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url) => String(url).startsWith("chrome-extension:")
    ? jsonResponse(glossary)
    : jsonResponse({ search: [{
      id: "Q99", label: "GET", description: "HTTP request method in computer networking",
    }] });
  const result = await lookupProgrammingMeanings("get");
  assert.equal(result.meanings.length, 0);
});

test("offline external API still returns local HTTP meaning with exact casing", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url) => {
    if (String(url).startsWith("chrome-extension:")) return jsonResponse(glossary);
    throw new Error("offline");
  };
  const upper = await lookupProgrammingMeanings("GET");
  const lower = await lookupProgrammingMeanings("get");
  assert.equal(upper.meanings[0].category, "HTTP Method");
  assert.equal(lower.meanings.length, 0);
  assert.equal(upper.lookupErrors[0].kind, "network");
});

test("rate limit keeps local results and pauses further Wikidata requests", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let externalRequests = 0;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith("chrome-extension:")) return jsonResponse(glossary);
    externalRequests += 1;
    return jsonResponse(null, 429);
  };
  const first = await lookupProgrammingMeanings("promise");
  const second = await lookupProgrammingMeanings("object");
  assert.equal(first.meanings[0].category, "JavaScript");
  assert.equal(second.meanings[0].category, "JavaScript");
  assert.equal(first.lookupErrors[0].kind, "rate-limit");
  assert.equal(externalRequests, 1);
});
