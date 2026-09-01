import { describe, expect, it } from "vitest";
import { validateSnapshot } from "./backup";

function makeSnapshot(limitCents: number) {
  return {
    version: 1,
    exportedAt: "2026-08-26T12:00:00.000Z",
    cards: [
      {
        id: "nubank",
        name: "Nubank",
        limitCents,
        active: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    invoices: [
      {
        id: "nubank-2026-08",
        cardId: "nubank",
        label: "agosto de 2026",
        periodStart: "2026-07-27T03:00:00.000Z",
        closingDate: "2026-08-26T03:00:00.000Z",
        limitCents,
        status: "open",
        createdAt: "2026-07-27T03:00:00.000Z",
      },
    ],
    entries: [],
    subscriptions: [],
  };
}

describe("backup validation", () => {
  it("accepts existing backups with positive limits", () => {
    expect(validateSnapshot(makeSnapshot(580000))).toBe(true);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 12.5])(
    "rejects an invalid limit of %s cents",
    (limitCents) => {
      expect(validateSnapshot(makeSnapshot(limitCents))).toBe(false);
    },
  );
});
