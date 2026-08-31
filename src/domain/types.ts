export type EntryType = "variable_expense" | "subscription_planned" | "subscription_charged";
export type EntryOrigin = "manual" | "qr_code" | "ocr" | "mercadeira_api";
export type InvoiceStatus = "open" | "closed";

export interface Card {
  id: string;
  name: string;
  limitCents: number;
  active: boolean;
  createdAt: string;
}

export interface Invoice {
  id: string;
  cardId: string;
  label: string;
  periodStart: string;
  closingDate: string;
  limitCents: number;
  status: InvoiceStatus;
  createdAt: string;
}

export interface Subscription {
  id: string;
  name: string;
  merchant?: string;
  amountCents: number;
  expectedDay: number;
  category: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Entry {
  id: string;
  invoiceId: string;
  cardId: string;
  occurredAt: string;
  merchant: string;
  description: string;
  amountCents: number;
  category: string;
  note?: string;
  type: EntryType;
  origin: EntryOrigin;
  subscriptionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSnapshot {
  version: 1;
  exportedAt: string;
  cards: Card[];
  invoices: Invoice[];
  entries: Entry[];
  subscriptions: Subscription[];
}

export interface EntryDraft {
  id?: string;
  occurredAt: string;
  merchant: string;
  description: string;
  amount: string;
  category: string;
  note: string;
  type: EntryType;
  subscriptionId?: string;
}
