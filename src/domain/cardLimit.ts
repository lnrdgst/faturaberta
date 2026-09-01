import type { Invoice } from "./types";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isValidLimitCents(value: number) {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

export function shouldUpdateInvoiceLimit(invoice: Invoice, referenceDate: Date) {
  const closingDate = startOfDay(new Date(invoice.closingDate));
  const referenceDay = startOfDay(referenceDate);
  return closingDate.getTime() >= referenceDay.getTime();
}

export function getInvoicesWithUpdatedLimit(
  invoices: Invoice[],
  cardId: string,
  limitCents: number,
  referenceDate: Date,
) {
  return invoices
    .filter((invoice) => invoice.cardId === cardId && shouldUpdateInvoiceLimit(invoice, referenceDate))
    .map((invoice) => ({ ...invoice, limitCents }));
}
