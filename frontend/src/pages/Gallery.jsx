import { useEffect, useMemo, useState } from "react";
import { Header } from "../components/Header";
import { PhotoTile } from "../components/PhotoTile";
import { Lightbox } from "../components/Lightbox";
import { PaymentBar } from "../components/PaymentBar";
import { CheckoutModal } from "../components/CheckoutModal";
import { PaymentMethodIcon } from "../components/PaymentIcons";
import { AlbumsGrid } from "../components/AlbumCard";
import { fetchPhotos, fetchConfig, fetchAlbums } from "../lib/api";
import { PACKS, computeTotal, computeSavings } from "../lib/pricing";
import { PAYMENT_METHODS } from "../lib/payments";
import { toast } from "sonner";
import {
  MagnifyingGlass,
  ShoppingBag,
  ShieldCheck,
  PaperPlaneTilt,
  Phone,
  DownloadSimple,
  Sparkle,
  PaypalLogo,
  InstagramLogo,
} from "@phosphor-icons/react";

export default function Gallery() {
  const [photos, setPhotos] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [config, setConfig] = useState({
    price_per_photo: 3,
    paypal_handle: "nophotopix",
    revolut_handle: "nophotopix",
    wero_phone: "+33760599312",
    wero_phone_display: "07 60 59 93 12",
    currency: "EUR",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
let cancelled = false;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const loadGallery = async () => {
setLoading(true);

for (let attempt = 1; attempt <= 3; attempt++) {
try {
const [al, ph, cfg] = await Promise.allSettled([
fetchAlbums(),
fetchPhotos(),
fetchConfig(),
]);

if (cancelled) return;

if (al.status === "fulfilled") {
setAlbums(Array.isArray(al.value) ? al.value : []);
}

if (ph.status === "fulfilled" && Array.isArray(ph.value)) {
setPhotos(ph.value);
} else {
throw new Error("Photos not loaded");
}

if (cfg.status === "fulfilled") {
setConfig((c) => ({ ...c, ...(cfg.value || {}) }));
}

setLoading(false);
return;
} catch (e) {
if (attempt < 3) {
await wait(2000);
} else {
if (!cancelled) {
toast.error("Impossible de charger la galerie");
setLoading(false);
}
}
}
}
};

loadGallery();

return () => {
cancelled = true;
};
}, []);

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

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const handlePay = () => {
    if (count === 0) return;
    setCheckoutOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white relative">
      <Header />

      {/* Hero */}
      <section className="relative max-w-[1600px] mx-auto px-6 lg:px-12 pt-16 pb-24 lg:pt-24 lg:pb-32">
        <div className="mx-auto flex flex-col items-center text-center">
          <p
            data-testid="hero-eyebrow"
            className="text-eyebrow text-white/40 mb-6 fade-up"
          >
            No.Photo.Pix · Galerie privée
          </p>
          <div
            data-testid="hero-logo"
            className="fade-up w-full flex justify-center items-center"
            style={{ animationDelay: "120ms" }}
          >
            <img
              src="https://customer-assets.emergentagent.com/job_image-select-pay/artifacts/oep52icz_nophotopix.jpg"
              alt="No.Photo.Pix"
              className="drop-shadow-[0_8px_40px_rgba(232,178,58,0.25)] max-w-full"
              style={{ height: "5cm", width: "15cm", objectFit: "fill" }}
            />
          </div>
          <h1
            data-testid="hero-tagline"
            className="font-display text-5xl sm:text-7xl lg:text-8xl text-white leading-[0.95] mt-4 fade-up"
            style={{ animationDelay: "200ms" }}
          >
            Vos photos
            <br />
            <span className="italic text-white/90">sont ici.</span>
          </h1>
          <p
            className="mt-6 text-white/60 text-lg sm:text-xl max-w-xl leading-relaxed fade-up"
            style={{ animationDelay: "300ms" }}
          >
            Scannez, choisissez, payez et recevez vos photos en HD.
          </p>

          {/* Pack cards */}
          <div
            data-testid="pack-cards"
            className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl fade-up"
            style={{ animationDelay: "400ms" }}
          >
            {PACKS.map((p) => {
              const popular = p.qty === 3;
              return (
                <div
                  key={p.qty}
                  data-testid={`pack-${p.qty}`}
                  className={`relative rounded-sm border p-6 text-left transition-all ${
                    popular
                      ? "border-[#E8B23A]/60 bg-gradient-to-br from-[#1a1206] via-[#0a0a0a] to-[#0a0a0a] shadow-[0_0_40px_rgba(232,178,58,0.12)]"
                      : "border-[#E8B23A]/20 bg-[#0a0a0a] hover:border-[#E8B23A]/40"
                  }`}
                >
                  {popular && (
                    <span
                      data-testid="popular-badge"
                      className="absolute -top-2.5 left-4 text-[10px] tracking-[0.25em] uppercase bg-gradient-to-r from-[#E8B23A] via-[#FFD66B] to-[#C8902A] text-black px-3 py-1 rounded-sm font-semibold shadow-[0_4px_20px_rgba(232,178,58,0.5)]"
                    >
                      Le plus populaire
                    </span>
                  )}
                  <p
                    className={`text-eyebrow ${
                      popular ? "text-[#E8B23A]" : "text-[#E8B23A]/60"
                    }`}
                  >
                    {p.qty} photo{p.qty > 1 ? "s" : ""}
                  </p>
                  <p
                    className={`font-display text-5xl mt-2 leading-none ${
                      popular
                        ? "bg-gradient-to-br from-[#FFE08A] via-[#E8B23A] to-[#B07A1E] bg-clip-text text-transparent"
                        : "text-white"
                    }`}
                  >
                    {p.price}{" "}
                    <span
                      className={`text-2xl ${
                        popular ? "text-[#E8B23A]" : "text-white/50"
                      }`}
                    >
                      €
                    </span>
                  </p>
                  {p.qty > 1 && (
                    <p className="text-white/40 text-xs mt-3">
                      soit {(p.price / p.qty).toFixed(2)} € / photo
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <p
            className="text-white/40 text-sm mt-5 fade-up"
            style={{ animationDelay: "500ms" }}
          >
            <Sparkle size={14} weight="fill" className="inline mr-1 text-[#E8B23A]" />
            Plus vous prenez, plus vous économisez.
          </p>
        </div>

        {/* Decorative number */}
        <div
          aria-hidden
          className="absolute right-6 top-20 lg:right-12 lg:top-32 font-display text-[10rem] lg:text-[16rem] leading-none text-white/[0.03] pointer-events-none select-none"
        >
          NPP
        </div>
      </section>

      {/* Gallery */}
      <section
        id="gallery"
        data-testid="gallery-section"
        className="max-w-[1600px] mx-auto px-6 lg:px-12 pb-40"
      >
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="text-eyebrow text-white/40">
              {albums.length > 0 ? "Les albums" : "La collection"}
            </p>
            <h2 className="font-display text-3xl sm:text-4xl text-white mt-2">
              {loading
                ? "Chargement des albums..."
                : albums.length > 0
                  ? `${albums.length} album${albums.length > 1 ? "s" : ""} disponible${albums.length > 1 ? "s" : ""}`
                  : `${photos.length} clichés disponibles`}
            </h2>
          </div>
          {albums.length === 0 && (
            <p className="text-white/40 text-sm hidden sm:block">
              <span data-testid="selected-summary" className="text-white">
                {count}
              </span>{" "}
              sélectionné{count > 1 ? "s" : ""}
            </p>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/3] bg-[#0a0a0a] rounded-sm animate-pulse"
              />
            ))}
          </div>
        ) : albums.length > 0 ? (
          <AlbumsGrid albums={albums} />
        ) : !Array.isArray(photos) || photos.length === 0 ? (
          <div
            data-testid="empty-gallery"
            className="text-center py-32 border border-white/10 rounded-sm"
          >
            <p className="font-display text-3xl text-white/40">
              Aucun album pour le moment
            </p>
            <p className="text-white/30 text-sm mt-3">
              Connectez-vous à l'admin pour créer votre premier album.
            </p>
          </div>
        ) : (
          <div
            data-testid="flat-photos-grid"
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

      {/* How it works */}
      <section
        id="how"
        data-testid="how-it-works"
        className="border-t border-white/10 max-w-[1600px] mx-auto px-6 lg:px-12 py-24"
      >
        <div className="mb-16 max-w-2xl">
          <p className="text-eyebrow text-white/40">Comment ça marche</p>
          <h2 className="font-display text-4xl sm:text-5xl text-white mt-3">
            Quatre étapes simples.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 border border-white/10">
          {[
            {
              icon: MagnifyingGlass,
              title: "Parcourez",
              text: "Découvrez la galerie et sélectionnez les photos qui vous parlent.",
            },
            {
              icon: ShoppingBag,
              title: "Choisissez votre pack",
              text: "1, 3 ou 5 photos. Plus vous prenez, plus vous économisez.",
            },
            {
              icon: ShieldCheck,
              title: "Payez en sécurité",
              text: "Paiement PayPal sécurisé en un clic. Pas de PayPal ? Contactez-nous.",
            },
            {
              icon: DownloadSimple,
              title: "Recevez en HD",
              text: "Envoyez votre preuve de paiement, recevez vos photos en HD rapidement.",
            },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={i}
                className="bg-[#0a0a0a] p-8 lg:p-10 hover:bg-[#111] transition-colors group"
              >
                <div className="flex items-baseline gap-4 mb-6">
                  <span className="font-display text-5xl text-white/20 group-hover:text-white/40 transition-colors">
                    0{i + 1}
                  </span>
                  <Icon size={22} weight="thin" className="text-white/60" />
                </div>
                <p className="font-display text-2xl text-white mb-3">
                  {s.title}
                </p>
                <p className="text-white/50 text-sm leading-relaxed">
                  {s.text}
                </p>
              </div>
            );
          })}
        </div>

        {/* No PayPal CTA */}
        <div
          data-testid="no-paypal-cta"
          className="mt-12 border border-[#E8B23A]/40 rounded-sm p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 bg-gradient-to-br from-[#1a1206]/60 via-[#0a0a0a] to-[#0a0a0a] shadow-[0_0_40px_rgba(232,178,58,0.08)]"
        >
          <div>
            <p className="text-eyebrow text-[#E8B23A] mb-2 tracking-[0.25em]">
              Pas de PayPal ?
            </p>
            <p className="font-display text-2xl bg-gradient-to-br from-[#FFE08A] via-[#E8B23A] to-[#B07A1E] bg-clip-text text-transparent">
              Contactez-moi, je trouve une solution.
            </p>
          </div>
          <a
            href="tel:0760599312"
            data-testid="contact-phone-cta"
            className="inline-flex items-center gap-3 bg-gradient-to-r from-[#E8B23A] via-[#FFD66B] to-[#C8902A] text-black px-6 py-3 rounded-full hover:brightness-110 transition-all text-sm font-semibold tracking-wide shadow-[0_4px_20px_rgba(232,178,58,0.4)]"
          >
            <Phone size={16} weight="fill" />
            07 60 59 93 12
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer
        id="about"
        className="border-t border-white/10 max-w-[1600px] mx-auto px-6 lg:px-12 py-16"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <img
              src="https://customer-assets.emergentagent.com/job_image-select-pay/artifacts/oep52icz_nophotopix.jpg"
              alt="No.Photo.Pix"
              className="w-14 h-14 rounded-sm object-cover"
            />
            <p className="text-white/40 text-sm mt-4 max-w-xs leading-relaxed">
              Photos en haute qualité. Livraison rapide & garantie.
            </p>
          </div>
          <div>
            <p className="text-eyebrow text-white/40 mb-4">Packs</p>
            <ul className="space-y-2 text-white/70 text-sm">
              <li>1 photo · 3 €</li>
              <li>3 photos · 8 € <span className="text-white/40">(populaire)</span></li>
              <li>5 photos · 12 €</li>
            </ul>
          </div>
          <div>
            <p className="text-eyebrow text-white/40 mb-4">Paiement</p>
            <div className="flex items-center gap-3 mb-4">
              {PAYMENT_METHODS.map((m) => (
                <div
                  key={m.id}
                  data-testid={`footer-payment-${m.id}`}
                  title={m.label}
                  className="hover:scale-110 transition-transform"
                >
                  <PaymentMethodIcon id={m.id} size={36} />
                </div>
              ))}
            </div>
            <ul className="space-y-2 text-white/70 text-sm">
              <li>
                <a
                  data-testid="footer-paypal-link"
                  href={`https://paypal.me/${config.paypal_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open(
                      `https://paypal.me/${config.paypal_handle}`,
                      "_blank",
                      "noopener,noreferrer"
                    );
                  }}
                  className="hover:text-white transition-colors text-xs"
                >
                  paypal.me/{config.paypal_handle}
                </a>
              </li>
              <li>
                <a
                  data-testid="footer-revolut-link"
                  href={`https://revolut.me/${config.revolut_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open(
                      `https://revolut.me/${config.revolut_handle}`,
                      "_blank",
                      "noopener,noreferrer"
                    );
                  }}
                  className="hover:text-white transition-colors text-xs"
                >
                  revolut.me/{config.revolut_handle}
                </a>
              </li>
              <li className="text-xs text-white/60">
                Wero · {config.wero_phone_display}
              </li>
            </ul>
          </div>
          <div>
            <p className="text-eyebrow text-white/40 mb-4">Contact</p>
            <ul className="space-y-2 text-white/70 text-sm">
              <li>
                <a
                  data-testid="footer-instagram"
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
                  aria-label="Instagram @no_photo_pix"
                  className="inline-flex items-center gap-3 group hover:text-white transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] group-hover:brightness-110 transition-all shadow-[0_4px_20px_rgba(221,42,123,0.35)]">
                    <InstagramLogo size={18} weight="bold" className="text-white" />
                  </span>
                  <span className="text-sm">@no_photo_pix</span>
                </a>
              </li>
              <li className="text-white/40 text-xs mt-3">Réponse rapide garantie</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <p className="text-white/30 text-xs tracking-[0.2em] uppercase">
            © 2026 No.Photo.Pix
          </p>
          <p className="text-white/30 text-xs tracking-[0.2em] uppercase">
            Tous droits réservés
          </p>
        </div>
      </footer>

      <PaymentBar
        count={count}
        total={total}
        savings={savings}
        paypalHandle={config.paypal_handle}
        currency={config.currency}
        onPay={handlePay}
        onClear={() => setSelected(new Set())}
      />

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        selectedIds={Array.from(selected)}
        total={total}
        config={config}
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
