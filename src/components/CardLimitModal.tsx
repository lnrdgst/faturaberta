interface CardLimitModalProps {
  amount: string;
  onChange: (amount: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function CardLimitModal({ amount, onChange, onCancel, onSubmit }: CardLimitModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-3 sm:items-center sm:justify-center">
      <div className="w-full max-w-md rounded-[2rem] border border-line bg-panel p-5 shadow-glow">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">Ajustar limite</h3>
            <p className="mt-1 text-sm text-slate-400">Informe o novo limite total do cartao.</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-line px-3 py-1 text-sm text-slate-300"
            onClick={onCancel}
          >
            Fechar
          </button>
        </div>

        <label className="field">
          <span>Limite em R$</span>
          <input
            inputMode="decimal"
            placeholder="Ex.: 5.800,00"
            value={amount}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={onSubmit}>
            Salvar limite
          </button>
        </div>
      </div>
    </div>
  );
}
