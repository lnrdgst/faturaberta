import { DEFAULT_CATEGORIES } from "../domain/constants";

interface SubscriptionDraft {
  id?: string;
  name: string;
  merchant: string;
  amount: string;
  expectedDay: string;
  category: string;
  active: boolean;
}

interface SubscriptionFormModalProps {
  draft: SubscriptionDraft;
  title: string;
  onChange: (draft: SubscriptionDraft) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export type { SubscriptionDraft };

export function SubscriptionFormModal({
  draft,
  title,
  onChange,
  onCancel,
  onSubmit,
}: SubscriptionFormModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-3 sm:items-center sm:justify-center">
      <div className="w-full max-w-lg rounded-[2rem] border border-line bg-panel p-5 shadow-glow">
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

        <div className="grid gap-4">
          <label className="field">
            <span>Nome</span>
            <input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} />
          </label>

          <label className="field">
            <span>Estabelecimento</span>
            <input
              value={draft.merchant}
              onChange={(event) => onChange({ ...draft, merchant: event.target.value })}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field">
              <span>Valor</span>
              <input value={draft.amount} onChange={(event) => onChange({ ...draft, amount: event.target.value })} />
            </label>

            <label className="field">
              <span>Dia previsto</span>
              <input
                type="number"
                min="1"
                max="31"
                value={draft.expectedDay}
                onChange={(event) => onChange({ ...draft, expectedDay: event.target.value })}
              />
            </label>
          </div>

          <label className="field">
            <span>Categoria</span>
            <input
              list="subscription-categories"
              value={draft.category}
              onChange={(event) => onChange({ ...draft, category: event.target.value })}
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-line bg-panelSoft px-4 py-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => onChange({ ...draft, active: event.target.checked })}
            />
            Manter assinatura ativa para próximas faturas
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={onSubmit}>
            Salvar assinatura
          </button>
        </div>

        <datalist id="subscription-categories">
          {DEFAULT_CATEGORIES.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
