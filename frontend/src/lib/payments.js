// Payment methods configuration
export const PAYMENT_METHODS = [
  {
    id: "paypal",
    label: "PayPal",
    sub: "Recommandé · Sécurisé",
    color: "#003087",
    accent: "#0070BA",
  },
  {
    id: "wero",
    label: "Wero",
    sub: "Paiement instantané SEPA",
    color: "#0066FF",
    accent: "#3D8AFF",
  },
  {
    id: "revolut",
    label: "Revolut",
    sub: "Paiement rapide international",
    color: "#0666EB",
    accent: "#1A1A1A",
  },
];

/** Returns the payment instruction object for a given method id + amount + config. */
export const buildPaymentInstruction = (methodId, total, config) => {
  switch (methodId) {
    case "paypal":
      return {
        kind: "url",
        action: "Ouvrir PayPal",
        url: `https://paypal.me/${config.paypal_handle}/${total}EUR`,
        instructions: `Vous serez redirigé vers paypal.me/${config.paypal_handle} pour payer ${total} €.`,
      };
    case "revolut":
      return {
        kind: "url",
        action: "Ouvrir Revolut",
        url: `https://revolut.me/${config.revolut_handle}`,
        instructions: `Vous serez redirigé vers revolut.me/${config.revolut_handle}. Indiquez le montant de ${total} €.`,
      };
    case "wero":
      return {
        kind: "phone",
        action: "Appeler / Copier le numéro",
        phone: config.wero_phone,
        phoneDisplay: config.wero_phone_display,
        instructions: `Ouvrez votre app bancaire Wero et envoyez ${total} € au ${config.wero_phone_display}.`,
      };
    default:
      return null;
  }
};
