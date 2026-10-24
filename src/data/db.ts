import Dexie, { type Table } from "dexie";
import { getInvoicesWithUpdatedLimit, isValidLimitCents } from "../domain/cardLimit";
import { DEFAULT_CARD_ID, DEFAULT_CARD_LIMIT_CENTS } from "../domain/constants";
import { buildInvoice, buildPlannedSubscriptionEntry, createNextInvoice } from "../domain/invoice";
import type { AppSnapshot, Card, Entry, Invoice, Subscription } from "../domain/types";

class FaturabertaDatabase extends Dexie {
  cards!: Table<Card, string>;
  invoices!: Table<Invoice, string>;
  entries!: Table<Entry, string>;
  subscriptions!: Table<Subscription, string>;

  constructor() {
    // Preserve o nome persistido para continuar acessando os dados locais existentes.
    super("faturometro");

    this.version(1).stores({
      cards: "id, active",
      invoices: "id, cardId, status, closingDate",
      entries: "id, invoiceId, cardId, occurredAt, merchant, description, type, subscriptionId",
      subscriptions: "id, active, name",
    });
  }
}

export const db = new FaturabertaDatabase();

function nowIso() {
  return new Date().toISOString();
}

function getDefaultCard(): Card {
  return {
    id: DEFAULT_CARD_ID,
    name: "Nubank",
    limitCents: DEFAULT_CARD_LIMIT_CENTS,
    active: true,
    createdAt: nowIso(),
  };
}

async function ensureDefaultCard() {
  const existing = await db.cards.get(DEFAULT_CARD_ID);
  if (existing) {
    return existing;
  }

  const card = getDefaultCard();
  await db.cards.add(card);
  return card;
}

function sortInvoices(invoices: Invoice[]) {
  return [...invoices].sort(
    (a, b) => new Date(b.closingDate).getTime() - new Date(a.closingDate).getTime(),
  );
}

async function ensureInvoiceForReference(card: Card, subscriptions: Subscription[], reference: Date) {
  const invoice = buildInvoice(card, reference);
  const existing = await db.invoices.get(invoice.id);

  if (!existing) {
    await db.invoices.add(invoice);

    const plannedEntries = subscriptions
      .filter((subscription) => subscription.active)
      .map((subscription) => buildPlannedSubscriptionEntry(invoice, subscription, card.id));

    if (plannedEntries.length > 0) {
      await db.entries.bulkPut(plannedEntries);
    }
  }

  return existing ?? invoice;
}

export async function initializeDatabase() {
  const card = await ensureDefaultCard();
  const subscriptions = await db.subscriptions.toArray();
  const currentInvoice = await ensureInvoiceForReference(card, subscriptions, new Date());
  const nextInvoice = createNextInvoice(currentInvoice);

  if (!(await db.invoices.get(nextInvoice.id))) {
    await db.invoices.add(nextInvoice);

    const plannedEntries = subscriptions
      .filter((subscription) => subscription.active)
      .map((subscription) => buildPlannedSubscriptionEntry(nextInvoice, subscription, card.id));

    if (plannedEntries.length > 0) {
      await db.entries.bulkPut(plannedEntries);
    }
  }
}

export async function loadSnapshot(): Promise<AppSnapshot> {
  await initializeDatabase();

  const [cards, invoices, entries, subscriptions] = await Promise.all([
    db.cards.toArray(),
    db.invoices.toArray(),
    db.entries.toArray(),
    db.subscriptions.toArray(),
  ]);

  return {
    version: 1,
    exportedAt: nowIso(),
    cards,
    invoices: sortInvoices(invoices),
    entries: [...entries].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    ),
    subscriptions: [...subscriptions].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  };
}

export async function saveEntry(entry: Entry) {
  await db.entries.put(entry);
  await initializeDatabase();
}

export async function deleteEntry(entryId: string) {
  await db.entries.delete(entryId);
}

export async function saveSubscription(subscription: Subscription) {
  await db.subscriptions.put(subscription);
  await initializeDatabase();
}

export async function updateCardLimit(cardId: string, limitCents: number, referenceDate = new Date()) {
  if (!isValidLimitCents(limitCents)) {
    throw new Error("O limite do cartao deve ser um valor positivo em centavos.");
  }

  await db.transaction("rw", [db.cards, db.invoices], async () => {
    const card = await db.cards.get(cardId);
    if (!card) {
      throw new Error("Cartao nao encontrado.");
    }

    const invoices = await db.invoices.where("cardId").equals(cardId).toArray();
    const invoicesToUpdate = getInvoicesWithUpdatedLimit(invoices, cardId, limitCents, referenceDate);

    await db.cards.put({ ...card, limitCents });
    if (invoicesToUpdate.length > 0) {
      await db.invoices.bulkPut(invoicesToUpdate);
    }
  });
}

export async function exportSnapshot() {
  return loadSnapshot();
}

export async function importSnapshot(snapshot: AppSnapshot) {
  await db.transaction("rw", [db.cards, db.invoices, db.entries, db.subscriptions], async () => {
    await Promise.all([
      db.cards.clear(),
      db.invoices.clear(),
      db.entries.clear(),
      db.subscriptions.clear(),
    ]);

    await db.cards.bulkPut(snapshot.cards);
    await db.invoices.bulkPut(snapshot.invoices);
    await db.entries.bulkPut(snapshot.entries);
    await db.subscriptions.bulkPut(snapshot.subscriptions);
  });

  await initializeDatabase();
}
