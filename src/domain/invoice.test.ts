import { describe, expect, it } from "vitest";
import {
  buildInvoice,
  calculateInvoiceTotals,
  calculateLimitUsage,
  createNextInvoice,
  estimateInvoiceProjection,
  getClosingDay,
} from "./invoice";
import type { Card, Entry } from "./types";

const card: Card = {
  id: "nubank",
  name: "Nubank",
  limitCents: 580000,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function makeEntry(amountCents: number, occurredAt: string): Entry {
  return {
    id: crypto.randomUUID(),
    invoiceId: "nubank-2026-08",
    cardId: "nubank",
    occurredAt,
    merchant: "Teste",
    description: "Item",
    amountCents,
    category: "Mercado",
    type: "variable_expense",
    origin: "manual",
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
}

describe("invoice rules", () => {
  it("calculates closing day for 31-day months", () => {
    expect(getClosingDay(2026, 0)).toBe(26);
  });

  it("calculates closing day for 30-day months", () => {
    expect(getClosingDay(2026, 3)).toBe(25);
  });

  it("calculates closing day for non-leap february", () => {
    expect(getClosingDay(2026, 1)).toBe(23);
  });

  it("calculates closing day for leap february", () => {
    expect(getClosingDay(2028, 1)).toBe(24);
  });

  it("creates current invoice across year boundary", () => {
    const invoice = buildInvoice(card, new Date("2027-01-03T12:00:00.000Z"));
    expect(invoice.periodStart.slice(0, 10)).toBe("2026-12-27");
    expect(invoice.closingDate.slice(0, 10)).toBe("2027-01-26");
  });

  it("calculates limit usage percentage", () => {
    expect(calculateLimitUsage(290000, 580000)).toBe(50);
  });

  it("creates the next invoice based on closing cycle", () => {
    const current = buildInvoice(card, new Date("2026-08-20T12:00:00.000Z"));
    const next = createNextInvoice(current);
    expect(next.periodStart.slice(0, 10)).toBe("2026-08-27");
    expect(next.closingDate.slice(0, 10)).toBe("2026-09-25");
  });

  it("estimates invoice projection when enough days have elapsed", () => {
    const invoice = buildInvoice(card, new Date("2026-08-10T12:00:00.000Z"));
    const entries = [
      makeEntry(10000, "2026-07-28T10:00:00.000Z"),
      makeEntry(20000, "2026-07-30T10:00:00.000Z"),
      makeEntry(15000, "2026-08-02T10:00:00.000Z"),
    ];

    const projection = estimateInvoiceProjection(invoice, entries, new Date("2026-08-10T12:00:00.000Z"));
    expect(projection).toBe(93000);
  });

  it("keeps totals split by variable and subscription entries", () => {
    const totals = calculateInvoiceTotals([
      makeEntry(1000, "2026-08-01T10:00:00.000Z"),
      {
        ...makeEntry(2000, "2026-08-02T10:00:00.000Z"),
        type: "subscription_planned",
      },
    ]);

    expect(totals.totalCents).toBe(3000);
    expect(totals.variableCents).toBe(1000);
    expect(totals.subscriptionCents).toBe(2000);
  });
});
