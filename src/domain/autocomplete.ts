import type { Entry } from "./types";

function normalize(text: string) {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

function toFriendlyLabel(values: string[]) {
  return values.reduce<Map<string, string>>((acc, value) => {
    const key = normalize(value);
    if (key && !acc.has(key)) {
      acc.set(key, value.trim().replace(/\s+/g, " "));
    }
    return acc;
  }, new Map());
}

export function deriveMerchantSuggestions(entries: Entry[]) {
  return Array.from(toFriendlyLabel(entries.map((entry) => entry.merchant)).values()).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

export function deriveDescriptionSuggestions(entries: Entry[]) {
  return Array.from(toFriendlyLabel(entries.map((entry) => entry.description)).values()).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}
