import { describe, expect, it } from "vitest";
import { calculateLimitUsage } from "./invoice";
import { getInvoicesWithUpdatedLimit, isValidLimitCents, shouldUpdateInvoiceLimit } from "./cardLimit";
import type { Invoice } from "./types";

function makeInvoice(id: string, cardId: string, closingDate: string, limitCents = 580000): Invoice {
  return {
    id,
    cardId,
    label: "Agosto 2026",
    periodStart: "2026-07-27T03:00:00.000Z",
    closingDate,
    limitCents,
    status: "open",
    createdAt: "2026-07-27T03:00:00.000Z",
  };
}

describe("card limit rules", () => {
  const referenceDate = new Date("2026-08-26T12:00:00.000Z");

  it("accepts only positive, finite integer cent values", () => {
    expect(isValidLimitCents(1)).toBe(true);
    expect(isValidLimitCents(580000)).toBe(true);
    expect(isValidLimitCents(0)).toBe(false);
    expect(isValidLimitCents(-1)).toBe(false);
    expect(isValidLimitCents(Number.NaN)).toBe(false);
    expect(isValidLimitCents(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidLimitCents(10.5)).toBe(false);
  });

  it("preserves invoices closed before the reference day", () => {
    const invoice = makeInvoice("past", "nubank", "2026-08-25T03:00:00.000Z");
    expect(shouldUpdateInvoiceLimit(invoice, referenceDate)).toBe(false);
  });

  it("updates invoices closing on the reference day and future invoices", () => {
    const sameDay = makeInvoice("same-day", "nubank", "2026-08-26T03:00:00.000Z");
    const future = makeInvoice("future", "nubank", "2026-09-25T03:00:00.000Z");

    expect(shouldUpdateInvoiceLimit(sameDay, referenceDate)).toBe(true);
    expect(shouldUpdateInvoiceLimit(future, referenceDate)).toBe(true);
  });

  it("updates only eligible invoices of the selected card without mutating the source invoices", () => {
    const past = makeInvoice("past", "nubank", "2026-08-25T03:00:00.000Z");
    const current = makeInvoice("current", "nubank", "2026-08-26T03:00:00.000Z");
    const future = makeInvoice("future", "nubank", "2026-09-25T03:00:00.000Z");
    const otherCard = makeInvoice("other", "other", "2026-09-25T03:00:00.000Z");
    const invoices = [past, current, future, otherCard];

    const updated = getInvoicesWithUpdatedLimit(invoices, "nubank", 750000, referenceDate);

    expect(updated.map((invoice) => invoice.id)).toEqual(["current", "future"]);
    expect(updated.every((invoice) => invoice.limitCents === 750000)).toBe(true);
    expect(invoices.map((invoice) => invoice.limitCents)).toEqual([580000, 580000, 580000, 580000]);
  });

  it("recalculates percentage from the updated invoice limit", () => {
    expect(calculateLimitUsage(290000, 400000)).toBe(72.5);
  });
});
