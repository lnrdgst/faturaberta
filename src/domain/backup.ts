import type { AppSnapshot, Card, Entry, Invoice, Subscription } from "./types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isArrayOfObjects(value: unknown) {
  return Array.isArray(value) && value.every((item) => isObject(item));
}

function hasString(object: Record<string, unknown>, key: string) {
  return typeof object[key] === "string";
}

function hasBoolean(object: Record<string, unknown>, key: string) {
  return typeof object[key] === "boolean";
}

function hasNumber(object: Record<string, unknown>, key: string) {
  return typeof object[key] === "number";
}

function isCard(value: unknown): value is Card {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "name") &&
    hasNumber(value, "limitCents") &&
    hasBoolean(value, "active") &&
    hasString(value, "createdAt")
  );
}

function isInvoice(value: unknown): value is Invoice {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "cardId") &&
    hasString(value, "label") &&
    hasString(value, "periodStart") &&
    hasString(value, "closingDate") &&
    hasNumber(value, "limitCents") &&
    hasString(value, "status") &&
    hasString(value, "createdAt")
  );
}

function isEntry(value: unknown): value is Entry {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "invoiceId") &&
    hasString(value, "cardId") &&
    hasString(value, "occurredAt") &&
    hasString(value, "merchant") &&
    hasString(value, "description") &&
    hasNumber(value, "amountCents") &&
    hasString(value, "category") &&
    hasString(value, "type") &&
    hasString(value, "origin") &&
    hasString(value, "createdAt") &&
    hasString(value, "updatedAt")
  );
}

function isSubscription(value: unknown): value is Subscription {
  return (
    isObject(value) &&
    hasString(value, "id") &&
    hasString(value, "name") &&
    hasNumber(value, "amountCents") &&
    hasNumber(value, "expectedDay") &&
    hasString(value, "category") &&
    hasBoolean(value, "active") &&
    hasString(value, "createdAt") &&
    hasString(value, "updatedAt")
  );
}

export function validateSnapshot(value: unknown): value is AppSnapshot {
  return (
    isObject(value) &&
    value.version === 1 &&
    hasString(value, "exportedAt") &&
    isArrayOfObjects(value.cards) &&
    isArrayOfObjects(value.invoices) &&
    isArrayOfObjects(value.entries) &&
    isArrayOfObjects(value.subscriptions) &&
    value.cards.every(isCard) &&
    value.invoices.every(isInvoice) &&
    value.entries.every(isEntry) &&
    value.subscriptions.every(isSubscription)
  );
}
