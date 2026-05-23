import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { PhotoCard } from "../components/PhotoCard";
import { PaymentBar } from "../components/PaymentBar";
import { CheckoutModal } from "../components/CheckoutModal";
import { fetchAlbum, fetchConfig } from "../lib/api";
import { computeTotal, computeSavings } from "../lib/pricing";
import { ArrowLeft, CalendarBlank } from "@phosphor-icons/react";
import { toast } from "sonner";

const formatDate = (date) => {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return date;
  }
};

export default function AlbumView() {
  const { albumId } = useParams();
  const navigate = useNavigate();
  const [album, setAlbum] = useState(null);
  const [config, setConfig] = useState({
    price_per_photo: 3,
    paypal_handle: "nophotopix",
    revolut_handle: "nophotopix",
    wero_phone: "+33760599312",
    wero_phone_display: "07 60 59 93 12",
    currency: "EUR",
  });
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAlbum(albumId), fetchConfig()])
      .then(([a, cfg]) => {
        setAlbum(a);
        setConfig((c) => ({ ...c, ...(cfg || {}) }));
      })
      .catch(() => {
        toast.error("Album introuvable");
        setAlbum(null);
      })
      .finally(() => setLoading(false));
  }, [albumId]);

  const photos = Array.isArray(album?.photos) ? album.photos : [];

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const count = selected.size;
  const total = useMemo(() => computeTotal(count), [count]);
  const savings = useMemo(() => computeSavings(count), [count]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505]">
        <Header />
        <div className="max-w-[1600px] mx-auto px-6 py-32 text-center text-white/40">
          Chargement de l'album...
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-screen bg-[#050505]">
        <Header />
        <div className="max-w-3xl mx-auto px-6 py-32 text-center">
          <p className="font-display text-3xl text-white/60">Album introuvable</p>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 mt-6 text-[#E8B23A] hover:underline"
          >
            <ArrowLeft size={16} /> Retour aux albums
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Header />

      {/* Cover hero */}
      <section
        data-testid="album-hero"
        className="relative max-w-[1600px] mx-auto px-6 lg:px-12 pt-12 pb-16"
      >
        <Link
          to="/"
          data-testid="album-back-btn"
          className="inline-flex items-center gap-2 text-white/60 hover:text-white text-eyebrow mb-8 transition-colors"
        >
          <ArrowLeft size={14} /> Tous les albums
        </Link>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-end">
          <div>
            <p className="text-eyebrow text-[#E8B23A] mb-4">Album</p>
            <h1
              data-testid="album-title"
              className="font-display text-5xl sm:text-6xl lg:text-7xl text-white leading-[0.95]"
            >
              {album.name}
            </h1>
            {album.date && (
              <p className="mt-6 text-white/60 text-base flex items-center gap-2">
                <CalendarBlank size={16} />
                {formatDate(album.date)}
              </p>
            )}
            {album.description && (
              <p className="mt-4 text-white/60 text-lg leading-relaxed max-w-xl">
                {album.description}
              </p>
            )}
            <p className="mt-6 text-white/40 text-sm">
              <span className="text-white font-display text-2xl">{photos.length}</span>{" "}
              photo{photos.length > 1 ? "s" : ""} · 3 € pièce
            </p>
          </div>
          {album.cover_url && (
            <div className="aspect-[4/3] overflow-hidden rounded-sm border border-[#E8B23A]/20">
              <img
                src={album.cover_url}
                alt={album.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      </section>

      {/* Photos grid */}
      <section
        data-testid="album-photos-section"
        className="max-w-[1600px] mx-auto px-6 lg:px-12 pb-40"
      >
        {photos.length === 0 ? (
          <div
            data-testid="album-empty"
            className="text-center py-32 border border-white/10 rounded-sm"
          >
            <p className="font-display text-3xl text-white/40">
              Pas encore de photos dans cet album
            </p>
          </div>
        ) : (
          <div className="masonry">
            {photos.map((photo, idx) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                index={idx}
                selected={selected.has(photo.id)}
                onToggle={toggle}
              />
            ))}
          </div>
        )}
      </section>

      <PaymentBar
        count={count}
        total={total}
        savings={savings}
        paypalHandle={config.paypal_handle}
        currency={config.currency}
        onPay={() => count > 0 && setCheckoutOpen(true)}
        onClear={() => setSelected(new Set())}
      />

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        selectedIds={Array.from(selected)}
        total={total}
        config={config}
      />
    </div>
  );
}
