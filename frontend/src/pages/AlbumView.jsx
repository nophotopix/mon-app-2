import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { PhotoTile } from "../components/PhotoTile";
import { Lightbox } from "../components/Lightbox";
import { PaymentBar } from "../components/PaymentBar";
import { CheckoutModal } from "../components/CheckoutModal";
import { fetchAlbum, fetchConfig, resolveImageUrl } from "../lib/api";
import { computeTotal, computeSavings } from "../lib/pricing";
import { ProtectedImage } from "../components/ProtectedImage";
import {
  ArrowLeft,
  CalendarBlank,
  ImageSquare,
  ShareNetwork,
} from "@phosphor-icons/react";
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
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    setLoading(true);
    setSelected(new Set());
    setLightboxIndex(null);
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

  const photos = useMemo(
    () => (Array.isArray(album?.photos) ? album.photos : []),
    [album]
  );

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

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${album.name} · No.Photo.Pix`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Lien copié dans le presse-papier");
      }
    } catch {
      // user cancelled
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Header />

      {/* Hero — full-width cinematic banner */}
      <section data-testid="album-hero" className="relative overflow-hidden">
        <div className="relative h-[42vh] min-h-[280px] max-h-[460px] w-full">
          {album.cover_url ? (
            <ProtectedImage
              src={resolveImageUrl(album.cover_url)}
              alt={album.name}
              wrapperClassName="absolute inset-0 w-full h-full"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1206] via-[#0a0a0a] to-black" />
          )}
          {/* Layered overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/40 to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(232,178,58,0.18),transparent_60%)]" />

          {/* Top-left back button */}
          <div className="absolute top-0 left-0 right-0 z-10 max-w-[1600px] mx-auto px-6 lg:px-12 pt-6">
            <Link
              to="/"
              data-testid="album-back-btn"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white text-eyebrow bg-black/40 backdrop-blur-md px-4 py-2 rounded-full transition-colors border border-white/10"
            >
              <ArrowLeft size={14} /> Tous les albums
            </Link>
          </div>

          {/* Center title block */}
          <div className="absolute inset-0 flex items-end">
            <div className="max-w-[1600px] mx-auto w-full px-6 lg:px-12 pb-10 lg:pb-14">
              <p className="text-eyebrow text-[#E8B23A] mb-3">Album</p>
              <h1
                data-testid="album-title"
                className="font-display text-4xl sm:text-6xl lg:text-7xl text-white leading-[0.95] max-w-4xl"
              >
                {album.name}
              </h1>
              <div className="mt-5 flex flex-wrap items-center gap-3 sm:gap-5 text-white/70 text-sm">
                {album.date && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarBlank size={14} />
                    {formatDate(album.date)}
                  </span>
                )}
                <span className="w-1 h-1 rounded-full bg-white/30 hidden sm:inline-block" />
                <span className="inline-flex items-center gap-1.5">
                  <ImageSquare size={14} weight="fill" />
                  <span data-testid="album-photo-count">{photos.length}</span>{" "}
                  photo{photos.length > 1 ? "s" : ""}
                </span>
                <span className="w-1 h-1 rounded-full bg-white/30 hidden sm:inline-block" />
                <span className="text-[#E8B23A] font-medium">3 € / photo</span>
                <button
                  data-testid="album-share-btn"
                  onClick={handleShare}
                  className="ml-auto inline-flex items-center gap-1.5 text-white/60 hover:text-white text-xs transition-colors"
                >
                  <ShareNetwork size={14} /> Partager
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Description bar (only if present) */}
        {album.description && (
          <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-6 border-b border-white/5">
            <p
              data-testid="album-description"
              className="text-white/60 text-base leading-relaxed max-w-3xl"
            >
              {album.description}
            </p>
          </div>
        )}
      </section>

      {/* Photos grid */}
      <section
        data-testid="album-photos-section"
        className="max-w-[1600px] mx-auto px-6 lg:px-12 pt-10 lg:pt-14 pb-40"
      >
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-eyebrow text-white/40">La collection</p>
            <h2 className="font-display text-2xl sm:text-3xl text-white mt-1">
              Cliquez sur le cœur pour sélectionner
            </h2>
          </div>
          <p className="text-white/40 text-xs sm:text-sm hidden sm:block">
            Cliquez sur une photo pour l'agrandir
          </p>
        </div>

        {photos.length === 0 ? (
          <div
            data-testid="album-empty"
            className="text-center py-32 border border-white/10 rounded-sm"
          >
            <p className="font-display text-2xl sm:text-3xl text-white/40">
              Pas encore de photos dans cet album
            </p>
            <p className="text-white/30 text-sm mt-3">
              Les photos seront ajoutées prochainement.
            </p>
          </div>
        ) : (
          <div
            data-testid="album-photos-grid"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4"
          >
            {photos.map((photo, idx) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                index={idx}
                selected={selected.has(photo.id)}
                onOpen={(i) => setLightboxIndex(i)}
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
        albumId={albumId}
      />

      <Lightbox
        photos={photos}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
        selectedIds={selected}
        onToggleSelect={toggle}
      />
    </div>
  );
}
