export class InvalidGlossaryDataError extends Error {
  constructor() {
    super("Data Glosarium tidak berbentuk array.");
    this.name = "InvalidGlossaryDataError";
  }
}

export function isValidGlossaryItem(item) {
  return Boolean(
    item &&
    typeof item === "object" &&
    !Array.isArray(item) &&
    typeof item.word === "string" &&
    item.word.trim() &&
    typeof item.translation === "string" &&
    typeof item.definition === "string",
  );
}

export function getProgrammingMeanings(value) {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object");
  return value && typeof value === "object" ? [value] : [];
}

function hasCaseSensitiveProgrammingMeaning(item) {
  return getProgrammingMeanings(item?.programmingMeaning)
    .some((meaning) => meaning.caseSensitive === true);
}

function glossaryWordsMatch(savedItem, newItem) {
  if (
    hasCaseSensitiveProgrammingMeaning(savedItem) ||
    hasCaseSensitiveProgrammingMeaning(newItem)
  ) {
    return savedItem.word.trim() === newItem.word.trim();
  }
  return savedItem.word.trim().toLowerCase() === newItem.word.trim().toLowerCase();
}

export async function readGlossary() {
  const data = await chrome.storage.local.get("glossary");
  if (data.glossary === undefined) return [];
  if (!Array.isArray(data.glossary)) throw new InvalidGlossaryDataError();
  return data.glossary;
}

export async function saveGlossaryItem(item) {
  const glossary = await readGlossary();
  const alreadySaved = glossary.some(
    (savedItem) => isValidGlossaryItem(savedItem) && glossaryWordsMatch(savedItem, item),
  );
  if (alreadySaved) return { duplicate: true };

  glossary.push({ ...item, savedAt: new Date().toISOString() });
  await chrome.storage.local.set({ glossary });
  return { duplicate: false };
}

export async function deleteGlossaryItem(item) {
  const glossary = await readGlossary();
  const targetIndex = glossary.findIndex((savedItem) =>
    isValidGlossaryItem(savedItem) &&
    savedItem.word === item.word &&
    savedItem.savedAt === item.savedAt &&
    savedItem.translation === item.translation &&
    savedItem.definition === item.definition
  );

  if (targetIndex === -1) throw new Error("Istilah yang dipilih tidak lagi tersedia.");
  glossary.splice(targetIndex, 1);
  await chrome.storage.local.set({ glossary });
}
