import { DEFAULT_CARD_LIMIT_CENTS } from "./constants";
import type { Card, Entry, EntryType, Invoice, Subscription } from "./types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toIsoDay(date: Date) {
  return startOfDay(date).toISOString();
}

function fromIso(iso: string) {
  return new Date(iso);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_IN_MS);
}

export function getMonthLastDay(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function getClosingDay(year: number, monthIndex: number) {
  return getMonthLastDay(year, monthIndex) - 5;
}

export function getClosingDate(year: number, monthIndex: number) {
  return new Date(year, monthIndex, getClosingDay(year, monthIndex));
}

export function getInvoicePeriodForDate(reference: Date) {
  const day = reference.getDate();
  const year = reference.getFullYear();
  const monthIndex = reference.getMonth();
  const currentClosingDay = getClosingDay(year, monthIndex);

  if (day <= currentClosingDay) {
    const periodStart = addDays(getClosingDate(year, monthIndex - 1), 1);
    const closingDate = getClosingDate(year, monthIndex);
    return { periodStart, closingDate };
  }

  const periodStart = addDays(getClosingDate(year, monthIndex), 1);
  const closingDate = getClosingDate(year, monthIndex + 1);
  return { periodStart, closingDate };
}

export function buildInvoiceLabel(closingDate: Date) {
  return closingDate.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

export function buildInvoiceId(cardId: string, closingDate: Date) {
  const year = closingDate.getFullYear();
  const month = String(closingDate.getMonth() + 1).padStart(2, "0");
  return `${cardId}-${year}-${month}`;
}

export function buildInvoice(card: Card, reference: Date, createdAt = new Date()): Invoice {
  const { periodStart, closingDate } = getInvoicePeriodForDate(reference);
  return {
    id: buildInvoiceId(card.id, closingDate),
    cardId: card.id,
    label: buildInvoiceLabel(closingDate),
    periodStart: toIsoDay(periodStart),
    closingDate: toIsoDay(closingDate),
    limitCents: card.limitCents,
    status: startOfDay(reference) > startOfDay(closingDate) ? "closed" : "open",
    createdAt: createdAt.toISOString(),
  };
}

export function createNextInvoice(invoice: Invoice): Invoice {
  const currentClosingDate = fromIso(invoice.closingDate);
  const nextReference = addDays(currentClosingDate, 6);
  const card: Card = {
    id: invoice.cardId,
    name: "",
    limitCents: invoice.limitCents || DEFAULT_CARD_LIMIT_CENTS,
    active: true,
    createdAt: invoice.createdAt,
  };
  return buildInvoice(card, nextReference, new Date(invoice.createdAt));
}

export function resolveUsageTone(percentage: number) {
  if (percentage >= 100) return "danger";
  if (percentage >= 85) return "high";
  if (percentage >= 70) return "medium";
  return "normal";
}

export function calculateInvoiceTotals(entries: Entry[]) {
  return entries.reduce(
    (acc, entry) => {
      acc.totalCents += entry.amountCents;
      if (entry.type === "variable_expense") {
        acc.variableCents += entry.amountCents;
      } else {
        acc.subscriptionCents += entry.amountCents;
      }
      acc.count += 1;
      return acc;
    },
    { totalCents: 0, variableCents: 0, subscriptionCents: 0, count: 0 },
  );
}

export function calculateLimitUsage(totalCents: number, limitCents: number) {
  if (limitCents <= 0) {
    return 0;
  }

  return (totalCents / limitCents) * 100;
}

export function estimateInvoiceProjection(invoice: Invoice, entries: Entry[], now: Date) {
  if (entries.length === 0) {
    return null;
  }

  const startedAt = startOfDay(fromIso(invoice.periodStart));
  const closingAt = startOfDay(fromIso(invoice.closingDate));
  const today = startOfDay(now);
  const elapsedDays = Math.floor((today.getTime() - startedAt.getTime()) / DAY_IN_MS) + 1;
  const totalDays = Math.floor((closingAt.getTime() - startedAt.getTime()) / DAY_IN_MS) + 1;

  if (elapsedDays < 3 || totalDays <= 0 || elapsedDays > totalDays) {
    return null;
  }

  const totalCents = calculateInvoiceTotals(entries).totalCents;
  return Math.round((totalCents / elapsedDays) * totalDays);
}

export function buildPlannedSubscriptionEntry(
  invoice: Invoice,
  subscription: Subscription,
  cardId: string,
): Entry {
  const closingDate = fromIso(invoice.closingDate);
  const scheduledDate = new Date(
    closingDate.getFullYear(),
    closingDate.getMonth(),
    Math.min(subscription.expectedDay, closingDate.getDate()),
    12,
    0,
    0,
    0,
  );
  const timestamp = new Date().toISOString();

  return {
    id: `${invoice.id}-${subscription.id}-planned`,
    invoiceId: invoice.id,
    cardId,
    occurredAt: scheduledDate.toISOString(),
    merchant: subscription.merchant ?? subscription.name,
    description: subscription.name,
    amountCents: subscription.amountCents,
    category: subscription.category,
    type: "subscription_planned",
    origin: "manual",
    subscriptionId: subscription.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function getEntryTypeLabel(type: EntryType) {
  if (type === "variable_expense") return "Gasto variável";
  if (type === "subscription_planned") return "Assinatura prevista";
  return "Assinatura cobrada";
}
