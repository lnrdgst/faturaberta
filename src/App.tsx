import { useCallback, useEffect, useState } from "react";
import { EntryFormModal } from "./components/EntryFormModal";
import { SectionCard } from "./components/SectionCard";
import { SubscriptionFormModal, type SubscriptionDraft } from "./components/SubscriptionFormModal";
import { exportSnapshot, importSnapshot, loadSnapshot, saveEntry, saveSubscription, deleteEntry } from "./data/db";
import { deriveDescriptionSuggestions, deriveMerchantSuggestions } from "./domain/autocomplete";
import { validateSnapshot } from "./domain/backup";
import { APP_STORAGE_KEY, DEFAULT_CARD_ID, DEFAULT_CATEGORIES } from "./domain/constants";
import { formatCurrencyFromCents, formatDate, formatDateTime, formatPercent, fromDateTimeLocalValue, parseCurrencyInputToCents, toDateTimeLocalValue } from "./domain/format";
import {
  calculateInvoiceTotals,
  calculateLimitUsage,
  estimateInvoiceProjection,
  getEntryTypeLabel,
  resolveUsageTone,
} from "./domain/invoice";
import type { AppSnapshot, Entry, EntryDraft, Subscription } from "./domain/types";

type TabId = "overview" | "history" | "subscriptions" | "backup";

const TAB_LABELS: Record<TabId, string> = {
  overview: "Resumo",
  history: "Histórico",
  subscriptions: "Assinaturas",
  backup: "Backup",
};

function createEntryDraft(entry?: Entry): EntryDraft {
  if (entry) {
    return {
      id: entry.id,
      occurredAt: toDateTimeLocalValue(entry.occurredAt),
      merchant: entry.merchant,
      description: entry.description,
      amount: String(entry.amountCents / 100).replace(".", ","),
      category: entry.category,
      note: entry.note ?? "",
      type: entry.type,
      subscriptionId: entry.subscriptionId,
    };
  }

  const now = new Date();
  return {
    occurredAt: toDateTimeLocalValue(now.toISOString()),
    merchant: "",
    description: "",
    amount: "",
    category: DEFAULT_CATEGORIES[0],
    note: "",
    type: "variable_expense",
  };
}

function createSubscriptionDraft(subscription?: Subscription): SubscriptionDraft {
  return {
    id: subscription?.id,
    name: subscription?.name ?? "",
    merchant: subscription?.merchant ?? "",
    amount: subscription ? String(subscription.amountCents / 100).replace(".", ",") : "",
    expectedDay: subscription ? String(subscription.expectedDay) : "10",
    category: subscription?.category ?? DEFAULT_CATEGORIES[1],
    active: subscription?.active ?? true,
  };
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getStoredTab() {
  const raw = localStorage.getItem(APP_STORAGE_KEY);
  if (!raw) {
    return "overview" as TabId;
  }

  try {
    const parsed = JSON.parse(raw) as { activeTab?: TabId };
    return parsed.activeTab ?? "overview";
  } catch {
    return "overview";
  }
}

export default function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>(getStoredTab);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [entryDraft, setEntryDraft] = useState<EntryDraft | null>(null);
  const [subscriptionDraft, setSubscriptionDraft] = useState<SubscriptionDraft | null>(null);
  const [search, setSearch] = useState("");
  const [ascending, setAscending] = useState(false);
  const [busy, setBusy] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify({ activeTab }));
  }, [activeTab]);

  const refresh = useCallback(async () => {
    setBusy(true);
    const nextSnapshot = await loadSnapshot();
    setSnapshot(nextSnapshot);

    if (!selectedInvoiceId) {
      const current = nextSnapshot.invoices.find((invoice) => invoice.status === "open") ?? nextSnapshot.invoices[0];
      setSelectedInvoiceId(current?.id ?? null);
    } else if (!nextSnapshot.invoices.some((invoice) => invoice.id === selectedInvoiceId)) {
      setSelectedInvoiceId(nextSnapshot.invoices[0]?.id ?? null);
    }

    setBusy(false);
  }, [selectedInvoiceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (busy || !snapshot) {
    return <main className="min-h-screen bg-ink bg-aura p-6 text-slate-100">Carregando Faturômetro...</main>;
  }

  const currentSnapshot = snapshot;
  const cardsById = Object.fromEntries(currentSnapshot.cards.map((card) => [card.id, card]));
  const selectedInvoice =
    currentSnapshot.invoices.find((invoice) => invoice.id === selectedInvoiceId) ??
    currentSnapshot.invoices.find((invoice) => invoice.status === "open") ??
    currentSnapshot.invoices[0];
  const invoiceEntries = selectedInvoice
    ? currentSnapshot.entries.filter((entry) => entry.invoiceId === selectedInvoice.id)
    : [];
  const filteredEntries = invoiceEntries
    .filter((entry) => {
      const needle = search.trim().toLocaleLowerCase("pt-BR");
      if (!needle) return true;
      return (
        entry.merchant.toLocaleLowerCase("pt-BR").includes(needle) ||
        entry.description.toLocaleLowerCase("pt-BR").includes(needle)
      );
    })
    .sort((a, b) =>
      ascending
        ? new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
        : new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );

  const totals = calculateInvoiceTotals(invoiceEntries);
  const usage = selectedInvoice ? calculateLimitUsage(totals.totalCents, selectedInvoice.limitCents) : 0;
  const tone = resolveUsageTone(usage);
  const projection = selectedInvoice ? estimateInvoiceProjection(selectedInvoice, invoiceEntries, new Date()) : null;
  const availableCents = selectedInvoice ? selectedInvoice.limitCents - totals.totalCents : 0;
  const merchantSuggestions = deriveMerchantSuggestions(currentSnapshot.entries);
  const descriptionSuggestions = deriveDescriptionSuggestions(currentSnapshot.entries);

  async function handleSaveEntry() {
    if (!entryDraft || !selectedInvoice) return;
    const amountCents = parseCurrencyInputToCents(entryDraft.amount);
    if (!amountCents || !entryDraft.merchant.trim() || !entryDraft.description.trim()) {
      setFeedback("Preencha valor, estabelecimento e descrição.");
      return;
    }

    const matchingInvoice =
      currentSnapshot.invoices.find((invoice) => {
        const occurredAt = new Date(fromDateTimeLocalValue(entryDraft.occurredAt)).getTime();
        const start = new Date(invoice.periodStart).getTime();
        const end = new Date(invoice.closingDate).getTime() + 86_399_999;
        return occurredAt >= start && occurredAt <= end;
      }) ?? selectedInvoice;

    const now = new Date().toISOString();
    const existing = entryDraft.id
      ? currentSnapshot.entries.find((entry) => entry.id === entryDraft.id)
      : undefined;

    await saveEntry({
      id: existing?.id ?? crypto.randomUUID(),
      invoiceId: matchingInvoice.id,
      cardId: matchingInvoice.cardId,
      occurredAt: fromDateTimeLocalValue(entryDraft.occurredAt),
      merchant: entryDraft.merchant.trim(),
      description: entryDraft.description.trim(),
      amountCents,
      category: entryDraft.category.trim() || DEFAULT_CATEGORIES[0],
      note: entryDraft.note.trim() || undefined,
      type: entryDraft.type,
      origin: "manual",
      subscriptionId: entryDraft.subscriptionId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    setEntryDraft(null);
    setFeedback("Lançamento salvo.");
    await refresh();
    setSelectedInvoiceId(matchingInvoice.id);
  }

  async function handleDeleteEntry(entryId: string) {
    await deleteEntry(entryId);
    setFeedback("Lançamento removido.");
    await refresh();
  }

  async function handleConfirmSubscriptionCharge(entry: Entry) {
    await saveEntry({
      ...entry,
      type: "subscription_charged",
      updatedAt: new Date().toISOString(),
    });
    setFeedback("Assinatura confirmada como cobrada.");
    await refresh();
  }

  async function handleSaveSubscription() {
    if (!subscriptionDraft) return;
    const amountCents = parseCurrencyInputToCents(subscriptionDraft.amount);
    const expectedDay = Number(subscriptionDraft.expectedDay);

    if (!amountCents || !subscriptionDraft.name.trim() || expectedDay < 1 || expectedDay > 31) {
      setFeedback("Revise nome, valor e dia previsto da assinatura.");
      return;
    }

    const existing = subscriptionDraft.id
      ? currentSnapshot.subscriptions.find((subscription) => subscription.id === subscriptionDraft.id)
      : undefined;
    const now = new Date().toISOString();

    await saveSubscription({
      id: existing?.id ?? crypto.randomUUID(),
      name: subscriptionDraft.name.trim(),
      merchant: subscriptionDraft.merchant.trim() || undefined,
      amountCents,
      expectedDay,
      category: subscriptionDraft.category.trim() || DEFAULT_CATEGORIES[1],
      active: subscriptionDraft.active,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    setSubscriptionDraft(null);
    setFeedback("Assinatura salva.");
    await refresh();
  }

  async function handleExport() {
    const exported = await exportSnapshot();
    downloadJson(`faturometro-backup-${new Date().toISOString().slice(0, 10)}.json`, exported);
    setFeedback("Backup exportado em JSON.");
  }

  async function handleImport(file: File | null) {
    if (!file) return;
    const text = await file.text();

    try {
      const parsed: unknown = JSON.parse(text);
      if (!validateSnapshot(parsed)) {
        setFeedback("Arquivo inválido para restauração.");
        return;
      }

      await importSnapshot(parsed);
      setFeedback("Backup restaurado com sucesso.");
      await refresh();
    } catch {
      setFeedback("Não foi possível importar o arquivo JSON.");
    }
  }

  return (
    <main className="min-h-screen bg-ink bg-aura text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6">
        <header className="rounded-[2rem] border border-line bg-panel/85 p-5 shadow-glow">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-accent">Faturômetro</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Fatura sob controle, sem complicar.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                Aplicativo local-first para acompanhar sua fatura do cartão, registrar gastos rapidamente e
                manter as assinaturas previstas separadas das cobranças já confirmadas.
              </p>
            </div>
            <div className="rounded-3xl border border-line bg-panelSoft px-4 py-3 text-sm text-slate-300">
              <div className="text-slate-400">Cartão ativo</div>
              <div className="mt-1 font-medium text-white">{cardsById[DEFAULT_CARD_ID]?.name ?? "Nubank"}</div>
              <div className="mt-1">{formatCurrencyFromCents(cardsById[DEFAULT_CARD_ID]?.limitCents ?? 0)} de limite</div>
            </div>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto pb-1">
          {(Object.keys(TAB_LABELS) as TabId[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`rounded-full px-4 py-2 text-sm transition ${
                activeTab === tab
                  ? "bg-accentStrong text-white"
                  : "border border-line bg-panel text-slate-300 hover:bg-panelSoft"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </nav>

        {feedback ? (
          <div className="rounded-2xl border border-accentStrong/40 bg-accentStrong/10 px-4 py-3 text-sm text-accent">
            {feedback}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="grid gap-6">
            <SectionCard
              title="Fatura atual"
              subtitle={selectedInvoice ? `Período iniciado em ${formatDate(selectedInvoice.periodStart)}` : undefined}
              action={
                <select
                  value={selectedInvoice?.id}
                  className="rounded-2xl border border-line bg-panelSoft px-3 py-2 text-sm text-slate-200"
                  onChange={(event) => setSelectedInvoiceId(event.target.value)}
                >
                  {currentSnapshot.invoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {cardsById[invoice.cardId]?.name ?? invoice.cardId} · {invoice.label}
                    </option>
                  ))}
                </select>
              }
            >
              {selectedInvoice ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <div className="text-sm text-slate-400">Uso da fatura</div>
                      <div className="mt-2 text-3xl font-semibold text-white">
                        {formatCurrencyFromCents(totals.totalCents)}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        de {formatCurrencyFromCents(selectedInvoice.limitCents)}
                      </div>
                    </div>
                    <Metric label="Disponível" value={formatCurrencyFromCents(availableCents)} tone={availableCents < 0 ? "danger" : "normal"} />
                    <Metric label="Gastos variáveis" value={formatCurrencyFromCents(totals.variableCents)} />
                    <Metric label="Assinaturas" value={formatCurrencyFromCents(totals.subscriptionCents)} />
                  </div>

                  <div className="mt-6">
                    <div className="mb-2 flex items-center justify-between text-sm text-slate-400">
                      <span>{formatPercent(usage)}% utilizado</span>
                      <span>Fechamento em {formatDate(selectedInvoice.closingDate)}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-panelSoft">
                      <div
                        className={`h-full rounded-full transition-all ${
                          tone === "danger"
                            ? "bg-danger"
                            : tone === "high"
                              ? "bg-orange-400"
                              : tone === "medium"
                                ? "bg-warning"
                                : "bg-accentStrong"
                        }`}
                        style={{ width: `${Math.min(usage, 100)}%` }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <Badge label={`${totals.count} lançamentos`} />
                      <Badge label={tone === "danger" ? "Limite ultrapassado" : "Limite monitorado"} tone={tone} />
                    </div>
                    {usage >= 100 ? (
                      <p className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                        Sua fatura ultrapassou o limite configurado. Revise os lançamentos ou ajuste o limite do cartão.
                      </p>
                    ) : null}
                  </div>
                </>
              ) : (
                <EmptyState text="Nenhuma fatura encontrada." />
              )}
            </SectionCard>

            {activeTab === "overview" ? (
              <SectionCard title="Projeção de fechamento" subtitle="Estimativa simples baseada no ritmo atual de gastos.">
                {projection ? (
                  <div className="space-y-3">
                    <p className="text-2xl font-semibold text-white">{formatCurrencyFromCents(projection)}</p>
                    <p className="text-sm leading-6 text-slate-400">
                      Se mantiver o ritmo atual, a fatura pode fechar em aproximadamente{" "}
                      <span className="text-slate-200">{formatCurrencyFromCents(projection)}</span>.
                    </p>
                  </div>
                ) : (
                  <EmptyState text="Dados insuficientes para projetar o fechamento desta fatura." />
                )}
              </SectionCard>
            ) : null}

            {activeTab === "history" ? (
              <SectionCard title="Histórico da fatura" subtitle="Busque, ordene e diferencie assinaturas de gastos variáveis.">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    className="input-base flex-1"
                    placeholder="Buscar por estabelecimento ou descrição"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <button type="button" className="btn-secondary" onClick={() => setAscending((value) => !value)}>
                    {ascending ? "Mais antigos primeiro" : "Mais recentes primeiro"}
                  </button>
                </div>
                <div className="space-y-3">
                  {filteredEntries.length > 0 ? (
                    filteredEntries.map((entry) => (
                      <article
                        key={entry.id}
                        className="rounded-3xl border border-line bg-panelSoft/70 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-white">{entry.merchant}</div>
                            <div className="text-sm text-slate-400">{entry.description}</div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              <Badge label={getEntryTypeLabel(entry.type)} tone={entry.type === "variable_expense" ? "normal" : "medium"} />
                              <Badge label={entry.category} />
                              <Badge label={formatDateTime(entry.occurredAt)} />
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-white">
                              {formatCurrencyFromCents(entry.amountCents)}
                            </div>
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                              {entry.type === "subscription_planned" ? (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => void handleConfirmSubscriptionCharge(entry)}
                                >
                                  Confirmar
                                </button>
                              ) : null}
                              <button type="button" className="btn-secondary" onClick={() => setEntryDraft(createEntryDraft(entry))}>
                                Editar
                              </button>
                              <button type="button" className="btn-danger" onClick={() => void handleDeleteEntry(entry.id)}>
                                Excluir
                              </button>
                            </div>
                          </div>
                        </div>
                        {entry.note ? <p className="mt-3 text-sm text-slate-400">{entry.note}</p> : null}
                      </article>
                    ))
                  ) : (
                    <EmptyState text="Nenhum lançamento encontrado para esta busca." />
                  )}
                </div>
              </SectionCard>
            ) : null}

            {activeTab === "subscriptions" ? (
              <SectionCard
                title="Assinaturas recorrentes"
                subtitle="Cada assinatura ativa gera um lançamento previsto ao abrir uma nova fatura."
                action={
                  <button type="button" className="btn-primary" onClick={() => setSubscriptionDraft(createSubscriptionDraft())}>
                    Nova assinatura
                  </button>
                }
              >
                <div className="space-y-3">
                  {currentSnapshot.subscriptions.length > 0 ? (
                    currentSnapshot.subscriptions.map((subscription) => (
                      <article key={subscription.id} className="rounded-3xl border border-line bg-panelSoft/70 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-medium text-white">{subscription.name}</div>
                            <div className="mt-1 text-sm text-slate-400">
                              {subscription.merchant ?? "Sem estabelecimento"} · Dia {subscription.expectedDay}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              <Badge label={subscription.category} />
                              <Badge label={subscription.active ? "Ativa" : "Inativa"} tone={subscription.active ? "normal" : "medium"} />
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-white">
                              {formatCurrencyFromCents(subscription.amountCents)}
                            </div>
                            <button
                              type="button"
                              className="btn-secondary mt-3"
                              onClick={() => setSubscriptionDraft(createSubscriptionDraft(subscription))}
                            >
                              Editar
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <EmptyState text="Você ainda não cadastrou assinaturas recorrentes." />
                  )}
                </div>
              </SectionCard>
            ) : null}

            {activeTab === "backup" ? (
              <SectionCard title="Backup local" subtitle="Exporte um JSON para guardar seus dados ou restaurar depois.">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <button type="button" className="btn-primary" onClick={() => void handleExport()}>
                    Exportar JSON
                  </button>
                  <label className="btn-secondary cursor-pointer text-center">
                    Importar JSON
                    <input
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={(event) => void handleImport(event.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-400">
                  A restauração valida a estrutura mínima do arquivo antes de substituir os dados locais.
                </p>
              </SectionCard>
            ) : null}
          </div>

          <aside className="grid gap-6">
            <SectionCard title="Próximas faturas" subtitle="Arquitetura centrada na entidade fatura, não apenas em mês.">
              <div className="space-y-3">
                {currentSnapshot.invoices.slice(0, 5).map((invoice) => (
                  <button
                    key={invoice.id}
                    type="button"
                    className={`w-full rounded-3xl border p-4 text-left ${
                      invoice.id === selectedInvoice?.id
                        ? "border-accentStrong bg-accentStrong/10"
                        : "border-line bg-panelSoft/70"
                    }`}
                    onClick={() => {
                      setSelectedInvoiceId(invoice.id);
                      setActiveTab("history");
                    }}
                  >
                    <div className="font-medium text-white">{invoice.label}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      Fecha em {formatDate(invoice.closingDate)}
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Atalho rápido" subtitle="Cadastro manual pronto para uso no celular.">
              <button type="button" className="btn-primary w-full justify-center" onClick={() => setEntryDraft(createEntryDraft())}>
                + Novo lançamento
              </button>
              <p className="mt-4 text-sm leading-6 text-slate-400">
                O lançamento é associado automaticamente à fatura correta conforme a data informada.
              </p>
            </SectionCard>
          </aside>
        </div>
      </div>

      <button
        type="button"
        className="fixed bottom-5 right-4 rounded-full bg-accentStrong px-5 py-4 text-lg font-semibold text-white shadow-glow sm:right-6"
        onClick={() => setEntryDraft(createEntryDraft())}
      >
        +
      </button>

      {entryDraft ? (
        <EntryFormModal
          title={entryDraft.id ? "Editar lançamento" : "Novo lançamento"}
          draft={entryDraft}
          merchantSuggestions={merchantSuggestions}
          descriptionSuggestions={descriptionSuggestions}
          subscriptions={currentSnapshot.subscriptions.filter((subscription) => subscription.active)}
          onChange={setEntryDraft}
          onCancel={() => setEntryDraft(null)}
          onSubmit={() => void handleSaveEntry()}
        />
      ) : null}

      {subscriptionDraft ? (
        <SubscriptionFormModal
          title={subscriptionDraft.id ? "Editar assinatura" : "Nova assinatura"}
          draft={subscriptionDraft}
          onChange={setSubscriptionDraft}
          onCancel={() => setSubscriptionDraft(null)}
          onSubmit={() => void handleSaveSubscription()}
        />
      ) : null}
    </main>
  );
}

function Metric({ label, value, tone = "normal" }: { label: string; value: string; tone?: "normal" | "danger" }) {
  return (
    <div className={`rounded-3xl border px-4 py-3 ${tone === "danger" ? "border-danger/30 bg-danger/10" : "border-line bg-panelSoft/70"}`}>
      <div className="text-sm text-slate-400">{label}</div>
      <div className={`mt-2 text-xl font-semibold ${tone === "danger" ? "text-danger" : "text-white"}`}>{value}</div>
    </div>
  );
}

function Badge({ label, tone = "normal" }: { label: string; tone?: "normal" | "medium" | "high" | "danger" }) {
  const classes =
    tone === "danger"
      ? "border-danger/30 bg-danger/10 text-danger"
      : tone === "high"
        ? "border-orange-400/30 bg-orange-400/10 text-orange-300"
        : tone === "medium"
          ? "border-warning/30 bg-warning/10 text-warning"
          : "border-line bg-panel text-slate-300";

  return <span className={`rounded-full border px-3 py-1 ${classes}`}>{label}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-3xl border border-dashed border-line bg-panelSoft/50 px-4 py-6 text-sm text-slate-400">{text}</p>;
}
