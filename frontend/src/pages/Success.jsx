import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "../components/Header";
import { fetchOrder, resolveImageUrl, downloadFileUrl } from "../lib/api";
import { PaymentMethodIcon } from "../components/PaymentIcons";
import { ProtectedImage } from "../components/ProtectedImage";
import { toast } from "sonner";
import {
  CheckCircle,
  DownloadSimple,
  Clock,
  ArrowLeft,
  InstagramLogo,
  EnvelopeSimple,
} from "@phosphor-icons/react";

const STATUS_META = {
  pending: {
    label: "En attente de validation",
    color: "text-amber-400",
    icon: Clock,
  },
  completed: {
    label: "Paiement validé",
    color: "text-emerald-400",
    icon: CheckCircle,
  },
  cancelled: {
    label: "Annulé",
    color: "text-red-400",
    icon: Clock,
  },
};

export default function Success() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pollCount, setPollCount] = useState(0);

  const load = async () => {
    try {
      const data = await fetchOrder(orderId);
      setOrder(data);
    } catch {
      toast.error("Commande introuvable");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Poll status every 12s for up to ~5min in case admin validates while user waits
    const interval = setInterval(() => {
      setPollCount((c) => {
        if (c >= 25) {
          clearInterval(interval);
          return c;
        }
        return c + 1;
      });
    }, 12000);
    return () => clearInterval(interval);
  }, [orderId]);

  useEffect(() => {
    if (pollCount > 0 && order?.status === "pending") {
      load();
    }
    // eslint-disable-next-line
  }, [pollCount]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white">
        <Header />
        <div className="max-w-3xl mx-auto px-6 py-32 text-center">
          <p className="text-white/40">Chargement de votre commande...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#050505] text-white">
        <Header />
        <div className="max-w-3xl mx-auto px-6 py-32 text-center">
          <p className="font-display text-3xl text-white/60">Commande introuvable</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 mt-6 text-[#E8B23A] hover:underline"
          >
            <ArrowLeft size={16} /> Retour à la galerie
          </Link>
        </div>
      </div>
    );
  }

  const meta = STATUS_META[order.status] || STATUS_META.pending;
  const StatusIcon = meta.icon;
  const isCompleted = order.status === "completed";

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Header />

      <div className="max-w-4xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
        {/* Hero */}
        <div className="text-center mb-16">
          <div
            data-testid="success-status-icon"
            className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${
              isCompleted
                ? "bg-emerald-400/10 border border-emerald-400/40"
                : "bg-amber-400/10 border border-amber-400/40"
            }`}
          >
            <StatusIcon
              size={36}
              weight={isCompleted ? "fill" : "regular"}
              className={meta.color}
            />
          </div>
          <p className="text-eyebrow text-[#E8B23A] mb-4">No.Photo.Pix · Commande</p>
          <h1
            data-testid="success-title"
            className="font-display text-5xl sm:text-6xl text-white leading-[0.95]"
          >
            Merci pour votre achat !
          </h1>
          <p className="text-white/60 text-lg mt-6 max-w-xl mx-auto leading-relaxed">
            {isCompleted
              ? "Votre paiement a été validé. Téléchargez vos photos en HD ci-dessous ou retrouvez-les dans votre email."
              : "Votre commande est bien enregistrée. Nous validons votre paiement manuellement après réception."}
          </p>
        </div>

        {/* Order summary */}
        <div className="border border-[#E8B23A]/20 rounded-sm bg-gradient-to-br from-[#1a1206]/30 via-[#0a0a0a] to-[#0a0a0a] p-6 lg:p-8 mb-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <p className="text-eyebrow text-white/40">Commande</p>
              <p
                data-testid="order-id"
                className="font-mono text-white text-sm mt-2"
              >
                #{order.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <div>
              <p className="text-eyebrow text-white/40">Photos</p>
              <p className="font-display text-2xl text-white mt-1">
                {Array.isArray(order.photo_ids) ? order.photo_ids.length : 0}
              </p>
            </div>
            <div>
              <p className="text-eyebrow text-white/40">Total</p>
              <p className="font-display text-2xl text-[#E8B23A] mt-1">
                {order.total} €
              </p>
            </div>
            <div>
              <p className="text-eyebrow text-white/40">Méthode</p>
              <div className="flex items-center gap-2 mt-1">
                <PaymentMethodIcon id={order.payment_method} size={24} />
                <span className="text-white text-sm capitalize">
                  {order.payment_method}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <StatusIcon
                size={16}
                weight={isCompleted ? "fill" : "regular"}
                className={meta.color}
              />
              <span
                data-testid="order-status"
                className={`text-sm ${meta.color}`}
              >
                {meta.label}
              </span>
            </div>
            <p className="text-white/40 text-xs flex items-center gap-2">
              <EnvelopeSimple size={14} />
              {order.email}
            </p>
          </div>
        </div>

        {/* Download CTA — secure 7-day link */}
        {isCompleted && order.download_token && (
          <div className="border border-emerald-400/30 rounded-sm bg-gradient-to-br from-emerald-500/5 via-[#0a0a0a] to-[#0a0a0a] p-6 lg:p-8 mb-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-eyebrow text-emerald-400 mb-2">Téléchargement HD disponible</p>
              <p className="text-white text-base leading-relaxed">
                Accédez à vos {Array.isArray(order.photo_ids) ? order.photo_ids.length : 0} photo(s) via votre lien sécurisé.
                Valable 48 heures.
              </p>
            </div>
            <Link
              to={`/download/${order.download_token}`}
              data-testid="success-download-cta"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#E8B23A] via-[#FFD66B] to-[#C8902A] text-black px-6 py-3 rounded-sm font-semibold tracking-wide text-sm hover:brightness-110 transition shrink-0"
            >
              <DownloadSimple size={16} weight="bold" />
              ACCÉDER À MES PHOTOS
            </Link>
          </div>
        )}

        {/* Photos */}
        <div className="mb-12">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-eyebrow text-white/40">Vos photos</p>
              <h2 className="font-display text-3xl text-white mt-2">
                {isCompleted ? "Téléchargez vos clichés" : "Aperçu de votre sélection"}
              </h2>
            </div>
          </div>

          <div
            data-testid="success-photos"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {(Array.isArray(order.photos) ? order.photos : []).map((p) => (
              <div
                key={p.id}
                className="relative aspect-square bg-[#0a0a0a] overflow-hidden rounded-sm group"
              >
                <ProtectedImage
                  src={resolveImageUrl(p.url)}
                  alt={p.title || ""}
                  wrapperClassName="w-full h-full"
                  className={`w-full h-full object-cover transition-all ${
                    isCompleted ? "" : "blur-sm grayscale brightness-50"
                  }`}
                />
                {isCompleted ? (
                  <a
                    data-testid={`download-${p.id}`}
                    href={
                      order.download_token
                        ? downloadFileUrl(order.download_token, p.id)
                        : resolveImageUrl(p.url)
                    }
                    download={p.title || "photo"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 flex items-end justify-center p-3 bg-gradient-to-t from-black/80 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <span className="inline-flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full text-sm font-medium">
                      <DownloadSimple size={14} weight="bold" /> HD
                    </span>
                  </a>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <Clock size={24} className="text-amber-400/80" weight="thin" />
                    <p className="text-amber-400/80 text-xs mt-2 tracking-wide uppercase">
                      En attente
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Next steps */}
        {!isCompleted && (
          <div className="border border-white/10 rounded-sm p-8 bg-[#0a0a0a]">
            <p className="text-eyebrow text-[#E8B23A] mb-3">Prochaine étape</p>
            <h3 className="font-display text-2xl text-white mb-4">
              Envoyez votre preuve de paiement
            </h3>
            <p className="text-white/60 text-sm leading-relaxed mb-6">
              Pour accélérer la validation de votre commande, envoyez votre preuve
              de paiement (capture d'écran) sur Instagram avec votre numéro de
              commande{" "}
              <span className="text-[#E8B23A] font-mono">
                #{order.id.slice(0, 8).toUpperCase()}
              </span>
              . Vous recevrez ensuite vos photos par email à{" "}
              <span className="text-white">{order.email}</span>.
            </p>
            <a
              href="https://www.instagram.com/no_photo_pix/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                window.open(
                  "https://www.instagram.com/no_photo_pix/",
                  "_blank",
                  "noopener,noreferrer"
                );
              }}
              data-testid="success-instagram-link"
              className="inline-flex items-center gap-3 bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white px-5 py-3 rounded-full hover:brightness-110 transition"
            >
              <InstagramLogo size={18} weight="bold" />
              <span className="font-medium text-sm">Contacter @no_photo_pix</span>
            </a>
          </div>
        )}

        <div className="mt-12 text-center">
          <Link
            to="/"
            data-testid="success-back-home"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white text-eyebrow transition-colors"
          >
            <ArrowLeft size={14} /> Retour à la galerie
          </Link>
        </div>
      </div>
    </div>
  );
}
