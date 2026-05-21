import { PaypalLogo } from "@phosphor-icons/react";

// Wero logo (simplified — text mark with brand blue/gradient)
const WeroIcon = ({ size = 32 }) => (
  <span
    style={{
      width: size,
      height: size,
      borderRadius: "9999px",
      background: "linear-gradient(135deg, #00B5FF 0%, #0066FF 100%)",
      color: "#fff",
      fontFamily: "Arial, sans-serif",
      fontWeight: 800,
      fontSize: size * 0.42,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      letterSpacing: "-0.04em",
      boxShadow: "0 2px 12px rgba(0,102,255,0.35)",
    }}
    aria-label="Wero"
  >
    W
  </span>
);

// Revolut logo (simplified — R monogram on dark)
const RevolutIcon = ({ size = 32 }) => (
  <span
    style={{
      width: size,
      height: size,
      borderRadius: "9999px",
      background: "linear-gradient(135deg, #1a1a1a 0%, #000 100%)",
      color: "#fff",
      fontFamily: "Georgia, serif",
      fontWeight: 700,
      fontSize: size * 0.5,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      border: "1px solid #333",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
    }}
    aria-label="Revolut"
  >
    R
  </span>
);

const PaypalIcon = ({ size = 32 }) => (
  <span
    style={{
      width: size,
      height: size,
      borderRadius: "9999px",
      background: "#003087",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 2px 12px rgba(0,48,135,0.4)",
    }}
    aria-label="PayPal"
  >
    <PaypalLogo size={size * 0.55} weight="bold" color="#fff" />
  </span>
);

export const PaymentMethodIcon = ({ id, size = 32 }) => {
  if (id === "paypal") return <PaypalIcon size={size} />;
  if (id === "wero") return <WeroIcon size={size} />;
  if (id === "revolut") return <RevolutIcon size={size} />;
  return null;
};
