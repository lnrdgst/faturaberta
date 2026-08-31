import { DEFAULT_CATEGORIES } from "../domain/constants";
import type { EntryDraft, EntryType, Subscription } from "../domain/types";

interface EntryFormModalProps {
  draft: EntryDraft;
  merchantSuggestions: string[];
  descriptionSuggestions: string[];
  subscriptions: Subscription[];
  onChange: (draft: EntryDraft) => void;
  onCancel: () => void;
  onSubmit: () => void;
  title: string;
}

function updateType(type: EntryType, draft: EntryDraft, subscriptions: Subscription[]) {
  if (type === "variable_expense") {
    return {
      ...draft,
      type,
      subscriptionId: undefined,
      category: draft.category || DEFAULT_CATEGORIES[0],
    };
  }

  const subscription = subscriptions.find((item) => item.id === draft.subscriptionId) ?? subscriptions[0];
  return {
    ...draft,
    type,
    subscriptionId: subscription?.id,
    category: subscription?.category ?? draft.category,
    merchant: subscription?.merchant ?? draft.merchant,
    description: subscription?.name ?? draft.description,
    amount: subscription ? String(subscription.amountCents / 100).replace(".", ",") : draft.amount,
  };
}

export function EntryFormModal({
  draft,
  merchantSuggestions,
  descriptionSuggestions,
  subscriptions,
  onChange,
  onCancel,
  onSubmit,
  title,
}: EntryFormModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-3 sm:items-center sm:justify-center">
      <div className="w-full max-w-xl rounded-[2rem] border border-line bg-panel p-5 shadow-glow">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">{title}</h3>
          <button
            type="button"
            className="rounded-full border border-line px-3 py-1 text-sm text-slate-300"
            onClick={onCancel}
          >
            Fechar
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field sm:col-span-2">
            <span>Tipo</span>
            <select
              value={draft.type}
              onChange={(event) => onChange(updateType(event.target.value as EntryType, draft, subscriptions))}
            >
              <option value="variable_expense">Gasto variável</option>
              <option value="subscription_planned">Assinatura prevista</option>
              <option value="subscription_charged">Assinatura cobrada</option>
            </select>
          </label>

          {(draft.type === "subscription_planned" || draft.type === "subscription_charged") && subscriptions.length > 0 ? (
            <label className="field sm:col-span-2">
              <span>Assinatura</span>
              <select
                value={draft.subscriptionId ?? subscriptions[0]?.id}
                onChange={(event) => {
                  const subscription = subscriptions.find((item) => item.id === event.target.value);
                  onChange({
                    ...draft,
                    subscriptionId: subscription?.id,
                    category: subscription?.category ?? draft.category,
                    merchant: subscription?.merchant ?? draft.merchant,
                    description: subscription?.name ?? draft.description,
                    amount: subscription ? String(subscription.amountCents / 100).replace(".", ",") : draft.amount,
                  });
                }}
              >
                {subscriptions.map((subscription) => (
                  <option key={subscription.id} value={subscription.id}>
                    {subscription.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="field">
            <span>Data e hora</span>
            <input
              type="datetime-local"
              value={draft.occurredAt}
              onChange={(event) => onChange({ ...draft, occurredAt: event.target.value })}
            />
          </label>

          <label className="field">
            <span>Valor</span>
            <input value={draft.amount} onChange={(event) => onChange({ ...draft, amount: event.target.value })} />
          </label>

          <label className="field">
            <span>Estabelecimento</span>
            <input
              list="merchant-suggestions"
              value={draft.merchant}
              onChange={(event) => onChange({ ...draft, merchant: event.target.value })}
            />
          </label>

          <label className="field">
            <span>Descrição</span>
            <input
              list="description-suggestions"
              value={draft.description}
              onChange={(event) => onChange({ ...draft, description: event.target.value })}
            />
          </label>

          <label className="field">
            <span>Categoria</span>
            <input
              list="category-suggestions"
              value={draft.category}
              onChange={(event) => onChange({ ...draft, category: event.target.value })}
            />
          </label>

          <label className="field sm:col-span-2">
            <span>Observação</span>
            <textarea
              rows={3}
              value={draft.note}
              onChange={(event) => onChange({ ...draft, note: event.target.value })}
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={onSubmit}>
            Salvar lançamento
          </button>
        </div>

        <datalist id="merchant-suggestions">
          {merchantSuggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
        <datalist id="description-suggestions">
          {descriptionSuggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
        <datalist id="category-suggestions">
          {DEFAULT_CATEGORIES.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
