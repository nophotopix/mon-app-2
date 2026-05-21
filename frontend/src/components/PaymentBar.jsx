import { ArrowRight, X } from "@phosphor-icons/react";

export const PaymentBar = ({
  count,
  total,
  savings = 0,
  paypalHandle,
  onPay,
  onClear,
  currency = "EUR",
}) => {
  if (count === 0) return null;

  return (
    <div
      data-testid="payment-bar"
      className="fixed bottom-6 left-1/2 z-50 slide-up"
      style={{ transform: "translateX(-50%)" }}
    >
      <div className="glass rounded-full shadow-[0_8px_40px_rgba(0,0,0,0.6)] flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-2 sm:py-3">
        {/* Clear */}
        <button
          data-testid="clear-selection-btn"
          onClick={onClear}
          aria-label="Effacer la sélection"
          className="w-9 h-9 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={16} />
        </button>

        {/* Count */}
        <div className="flex flex-col items-start min-w-[64px]">
          <span className="text-white text-lg font-light leading-none">
            <span data-testid="selection-count">{count}</span>{" "}
            <span className="text-white/40 text-sm">
              {count === 1 ? "photo" : "photos"}
            </span>
          </span>
          <span className="text-eyebrow text-white/40 mt-1">
            {count >= 5
              ? "Pack 5 · 12 €"
              : count >= 3
              ? "Pack 3 · 8 €"
              : "3 € / photo"}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-10 bg-white/10" />

        {/* Total */}
        <div className="flex flex-col items-start mr-1">
          <span className="text-eyebrow text-white/40">
            {savings > 0 ? (
              <>
                Total{" "}
                <span
                  data-testid="savings-badge"
                  className="text-emerald-400/80 normal-case tracking-normal"
                >
                  · −{savings} €
                </span>
              </>
            ) : (
              "Total"
            )}
          </span>
          <span
            data-testid="total-price"
            className="font-display text-2xl text-white leading-none mt-0.5"
          >
            {total} <span className="text-white/60 text-lg">{currency === "EUR" ? "€" : currency}</span>
          </span>
        </div>

        {/* Pay button */}
        <button
          data-testid="paypal-pay-btn"
          onClick={onPay}
          className="group flex items-center gap-2 bg-gradient-to-r from-[#E8B23A] via-[#FFD66B] to-[#C8902A] text-black hover:brightness-110 active:scale-[0.98] transition-all px-4 sm:px-5 py-2.5 rounded-full shadow-[0_4px_20px_rgba(232,178,58,0.4)]"
        >
          <span className="text-sm font-semibold tracking-wide whitespace-nowrap">
            Payer {total} €
          </span>
          <ArrowRight
            size={16}
            weight="bold"
            className="transition-transform group-hover:translate-x-0.5"
          />
        </button>
      </div>

      <p className="text-center text-white/30 text-[10px] tracking-[0.2em] uppercase mt-3">
        PayPal · Wero · Revolut
      </p>
    </div>
  );
};
