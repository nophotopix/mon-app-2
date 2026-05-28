import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, EnvelopeSimple, ArrowRight, CheckCircle } from "@phosphor-icons/react";
import { PAYMENT_METHODS, buildPaymentInstruction } from "../lib/payments";
import { confirmOrderPaid, createOrder, fetchOrder, resolveImageUrl } from "../lib/api";
import { toast } from "sonner";
import { PaymentMethodIcon } from "./PaymentIcons";
import { ProtectedImage } from "./ProtectedImage";

export const CheckoutModal = ({
  open,
  onClose,
  selectedIds,
  total,
  config,
  albumId,
}) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=info, 2=method, 3=instructions, 4=confirmation
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [method, setMethod] = useState("paypal");
  const [proofOpen, setProofOpen] = useState(false);
  const [proofText, setProofText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState(null);
  const [paymentWindowOpened, setPaymentWindowOpened] = useState(false);

  if (!open) return null;

  const reset = () => {
    setStep(1);
    setEmail("");
    setPhone("");
    setName("");
    setMethod("paypal");
    setSubmitting(false);
    setOrder(null);
    setProofOpen(false);
    setProofText("");
    setPaymentWindowOpened(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const submitOrder = async () => {
    if (!validEmail || selectedIds.length === 0) return;
    setSubmitting(true);
    try {
      const created = await createOrder({
        email,
        photo_ids: selectedIds,
        total,
        payment_method: method,
        name: name.trim() ? name.trim() : null,
        phone: phone.trim() ? phone.trim() : null,
        album_id: albumId || null,
      });
      const hydrated = await fetchOrder(created.id);
      setOrder(hydrated);
      setStep(3);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur lors de la création de la commande");
    } finally {
      setSubmitting(false);
    }
  };

  const instruction = order ? buildPaymentInstruction(method, total, config) : null;

  const handlePayAction = () => {
    if (!instruction) return;
    if (instruction.kind === "url") {
      window.open(instruction.url, "_blank", "noopener,noreferrer");
    } else if (instruction.kind === "phone") {
      window.open(`tel:${instruction.phone}`, "_blank", "noopener,noreferrer");
      navigator.clipboard?.writeText(instruction.phone).catch(() => {});
      toast.success(`Numéro Wero copié : ${instruction.phoneDisplay}`);
    }
    setPaymentWindowOpened(true);
  };

  const goToSuccess = () => {
    if (order) navigate(`/success/${order.id}`);
    close();
  };

  return (
    <div
      data-testid="checkout-modal"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={close}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-[#E8B23A]/30 rounded-sm shadow-[0_30px_80px_rgba(0,0,0,0.8)] max-h-[90vh] overflow-y-auto">
        <button
          data-testid="checkout-close"
          onClick={close}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Fermer"
        >
          <X size={18} />
        </button>

        <div className="p-8 lg:p-10">
          <p className="text-eyebrow text-[#E8B23A] mb-2">Étape {step} / 4</p>
          <h2 className="font-display text-3xl text-white mb-2">
            {step === 1 && "Vos coordonnées"}
            {step === 2 && "Méthode de paiement"}
            {step === 3 && "Finalisez votre paiement"}
            {step === 4 && "Confirmez votre paiement"}
          </h2>
          <p className="text-white/50 text-sm mb-8">
            {step === 1 && `${selectedIds.length} photo(s) · Total ${total} €`}
            {step === 2 && "Choisissez comment vous souhaitez payer"}
            {step === 3 && instruction?.instructions}
          </p>

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="text-eyebrow text-white/40 block mb-2">
                  Email pour recevoir vos photos
                </label>
                <div className="relative">
                  <EnvelopeSimple
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
                  />
                  <input
                    data-testid="checkout-email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    className="w-full bg-[#050505] border border-white/10 focus:border-[#E8B23A]/60 outline-none text-white pl-11 pr-4 py-4 rounded-sm transition-colors"
                    autoFocus
                  />
                </div>
                <p className="text-white/40 text-xs mt-2 leading-relaxed">
                  Vous recevrez les liens de téléchargement HD à cette adresse après votre confirmation de paiement.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-eyebrow text-white/40 block mb-2">
                    Nom (optionnel)
                  </label>
                  <input
                    data-testid="checkout-name-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Votre nom"
                    className="w-full bg-[#050505] border border-white/10 focus:border-[#E8B23A]/60 outline-none text-white px-4 py-4 rounded-sm transition-colors"
                    autoFocus={false}
                  />
                </div>

                <div>
                  <label className="text-eyebrow text-white/40 block mb-2">
                    Téléphone (optionnel)
                  </label>
                  <input
                    data-testid="checkout-phone-input"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+33..."
                    className="w-full bg-[#050505] border border-white/10 focus:border-[#E8B23A]/60 outline-none text-white px-4 py-4 rounded-sm transition-colors"
                  />
                </div>
              </div>
              <button
                data-testid="checkout-next-step-btn"
                disabled={!validEmail}
                onClick={() => setStep(2)}
                className="w-full bg-gradient-to-r from-[#E8B23A] via-[#FFD66B] to-[#C8902A] text-black py-4 rounded-sm font-semibold tracking-wide flex items-center justify-center gap-2 hover:brightness-110 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Continuer <ArrowRight size={16} weight="bold" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  data-testid={`checkout-method-${m.id}`}
                  onClick={() => setMethod(m.id)}
                  className={`w-full text-left p-5 rounded-sm border transition-all flex items-center gap-4 ${
                    method === m.id
                      ? "border-[#E8B23A] bg-[#E8B23A]/[0.06]"
                      : "border-white/10 hover:border-white/30 bg-[#050505]"
                  }`}
                >
                  <PaymentMethodIcon id={m.id} size={36} />
                  <div className="flex-1">
                    <p className="text-white font-medium">{m.label}</p>
                    <p className="text-white/50 text-xs mt-1">{m.sub}</p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      method === m.id ? "border-[#E8B23A] bg-[#E8B23A]" : "border-white/30"
                    }`}
                  >
                    {method === m.id && (
                      <CheckCircle size={12} weight="fill" className="text-black" />
                    )}
                  </div>
                </button>
              ))}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-5 py-3 border border-white/10 text-white/70 hover:text-white hover:border-white/30 rounded-sm transition-colors text-sm"
                >
                  Retour
                </button>
                <button
                  data-testid="checkout-confirm-method-btn"
                  disabled={submitting}
                  onClick={submitOrder}
                  className="flex-1 bg-gradient-to-r from-[#E8B23A] via-[#FFD66B] to-[#C8902A] text-black py-3 rounded-sm font-semibold tracking-wide hover:brightness-110 transition disabled:opacity-50"
                >
                  {submitting ? "Création..." : `Payer ${total} €`}
                </button>
              </div>
            </div>
          )}

          {step === 3 && order && instruction && (
            <>
              {!paymentWindowOpened && (
                <div className="space-y-5">
                  <div className="border border-[#E8B23A]/30 bg-[#E8B23A]/[0.04] rounded-sm p-5">
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div>
                        <p className="text-eyebrow text-[#E8B23A]">Résumé de commande</p>
                        <p className="text-white/50 text-sm mt-1">{order.photos.length} photo(s) · {total} €</p>
                      </div>
                      <div className="rounded-full bg-white/5 px-3 py-1 text-sm text-white/70">
                        {PAYMENT_METHODS.find((m) => m.id === method)?.label}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-sm bg-[#050505] p-4 border border-white/10">
                        <p className="text-white/60 text-xs uppercase tracking-[0.18em] mb-2">Total</p>
                        <p className="text-white font-semibold text-2xl">{total} €</p>
                      </div>
                      <div className="rounded-sm bg-[#050505] p-4 border border-white/10">
                        <p className="text-white/60 text-xs uppercase tracking-[0.18em] mb-2">Album</p>
                        <p className="text-white text-sm">{order.album_name || "Galerie"}</p>
                      </div>
                    </div>
                  </div>

                  {Array.isArray(order.photos) && order.photos.length > 0 && (
                    <div className="border border-white/10 bg-[#050505] rounded-sm p-4">
                      <p className="text-eyebrow text-[#E8B23A] mb-3">Photos sélectionnées</p>
                      <div className="flex flex-wrap gap-2">
                        {order.photos.slice(0, 8).map((p) => (
                          <div key={p.id} className="w-14 h-14 rounded-sm overflow-hidden">
                            <ProtectedImage
                              src={resolveImageUrl(p.url)}
                              alt={p.title || ""}
                              wrapperClassName="w-full h-full"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                        {order.photos.length > 8 && (
                          <div className="w-14 h-14 rounded-sm bg-white/5 flex items-center justify-center text-white/60 text-xs">
                            +{order.photos.length - 8}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="border border-[#E8B23A]/30 bg-[#E8B23A]/[0.04] rounded-sm p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <PaymentMethodIcon id={method} size={32} />
                      <div>
                        <p className="text-white font-medium">
                          {PAYMENT_METHODS.find((m) => m.id === method)?.label}
                        </p>
                        <p className="text-white/50 text-xs">Commande #{order.id.slice(0, 8)}</p>
                      </div>
                    </div>
                    <p className="text-white/70 text-sm leading-relaxed mb-4">
                      {instruction.instructions}
                    </p>
                    {instruction.kind === "phone" ? (
                      <p
                        data-testid="wero-phone"
                        className="font-display text-3xl text-[#E8B23A] tracking-wider"
                      >
                        {instruction.phoneDisplay}
                      </p>
                    ) : (
                      <p className="text-white/70 text-sm break-all">{instruction.url}</p>
                    )}
                  </div>

                  <button
                    data-testid="checkout-pay-action-btn"
                    onClick={handlePayAction}
                    className="w-full bg-gradient-to-r from-[#E8B23A] via-[#FFD66B] to-[#C8902A] text-black py-4 rounded-sm font-semibold tracking-wide hover:brightness-110 transition flex items-center justify-center gap-2"
                  >
                    Ouvrir {PAYMENT_METHODS.find((m) => m.id === method)?.label} <ArrowRight size={16} weight="bold" />
                  </button>

                  <p className="text-white/40 text-sm leading-relaxed text-center">
                    Après l’ouverture du moyen de paiement, revenez ici pour confirmer votre paiement.
                  </p>
                </div>
              )}

              {paymentWindowOpened && (
                <div className="space-y-5">
                  <div className="border border-[#E8B23A]/30 bg-[#E8B23A]/[0.04] rounded-sm p-5">
                    <p className="text-eyebrow text-[#E8B23A] mb-2">Avez-vous finalisé votre paiement ?</p>
                    <p className="text-white/60 text-sm leading-relaxed">
                      Votre commande temporaire est conservée. Confirmez dès que possible pour recevoir votre lien HD sécurisé par email.
                    </p>
                  </div>

                  <div className="border border-white/10 bg-[#050505] rounded-sm p-4">
                    <p className="text-eyebrow text-[#E8B23A] mb-3">Détails de la commande</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-white/50 text-xs uppercase tracking-[0.18em] mb-1">Montant</p>
                        <p className="text-white font-semibold">{total} €</p>
                      </div>
                      <div>
                        <p className="text-white/50 text-xs uppercase tracking-[0.18em] mb-1">Méthode</p>
                        <p className="text-white font-semibold">{PAYMENT_METHODS.find((m) => m.id === method)?.label}</p>
                      </div>
                      <div>
                        <p className="text-white/50 text-xs uppercase tracking-[0.18em] mb-1">Photos</p>
                        <p className="text-white font-semibold">{order.photos.length}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    data-testid="checkout-after-payment-btn"
                    onClick={async () => {
                      if (!order) return;
                      setSubmitting(true);
                      try {
                        const proof = proofText.trim();
                        await confirmOrderPaid(order.id, proof ? { proof } : {});
                        navigate(`/success/${order.id}`);
                        close();
                      } catch (err) {
                        toast.error(
                          err?.response?.data?.detail || "Erreur lors de la confirmation de paiement"
                        );
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-[#E8B23A] via-[#FFD66B] to-[#C8902A] text-black py-4 rounded-sm font-semibold tracking-wide hover:brightness-110 transition disabled:opacity-50 text-sm"
                  >
                    {submitting ? "Traitement..." : "J’ai finalisé le paiement"}
                  </button>

                  <button
                    data-testid="checkout-proof-btn"
                    onClick={() => setProofOpen((v) => !v)}
                    className="w-full border border-white/15 text-white hover:bg-white/5 py-4 rounded-sm transition-colors text-sm"
                  >
                    Envoyer une preuve (optionnel)
                  </button>

                  {proofOpen && (
                    <div className="border border-white/10 bg-[#050505] rounded-sm p-4 space-y-3">
                      <p className="text-eyebrow text-white/40">Preuve de paiement</p>
                      <textarea
                        data-testid="checkout-proof-input"
                        value={proofText}
                        onChange={(e) => setProofText(e.target.value)}
                        placeholder="Lien vers la preuve / capture d'écran (optionnel)"
                        className="w-full min-h-[90px] bg-[#0a0a0a] border border-white/10 focus:border-[#E8B23A]/60 outline-none text-white px-4 py-3 rounded-sm transition-colors"
                      />
                    </div>
                  )}

                  <button
                    data-testid="checkout-pay-later-btn"
                    onClick={() => {
                      toast.success("Votre commande temporaire est conservée.");
                      close();
                    }}
                    className="w-full border border-white/15 text-white hover:bg-white/5 py-4 rounded-sm transition-colors text-sm"
                  >
                    Je reviendrai plus tard
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
