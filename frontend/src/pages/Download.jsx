import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "../components/Header";
import { fetchDownload, downloadFileUrl } from "../lib/api";
import { ProtectedImage } from "../components/ProtectedImage";
import {
  DownloadSimple,
  CheckCircle,
  ArrowLeft,
  Clock,
  WarningCircle,
  EnvelopeSimple,
} from "@phosphor-icons/react";

export default function Download() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchDownload(token);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) {
          const status = e?.response?.status;
          const detail = e?.response?.data?.detail;
          if (status === 410) setError("expired");
          else if (status === 404) setError("notfound");
          else setError(detail || "Erreur de chargement");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white">
        <Header />
        <div
          data-testid="download-loading"
          className="max-w-3xl mx-auto px-6 py-32 text-center"
        >
          <p className="text-white/40 tracking-widest text-sm uppercase">
            Vérification du lien...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    const isExpired = error === "expired";
    const isNotFound = error === "notfound";
    return (
      <div className="min-h-screen bg-[#050505] text-white">
        <Header />
        <div className="max-w-2xl mx-auto px-6 py-32 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 bg-red-500/10 border border-red-500/40">
            <WarningCircle size={36} weight="thin" className="text-red-400" />
          </div>
          <h1
            data-testid="download-error-title"
            className="font-display text-4xl sm:text-5xl text-white leading-tight"
          >
            {isExpired
              ? "Ce lien a expiré"
              : isNotFound
              ? "Lien invalide"
              : "Une erreur est survenue"}
          </h1>
          <p className="text-white/60 text-base mt-6 leading-relaxed">
            {isExpired
              ? "Les liens de téléchargement sont valables 48 heures. Contactez-nous sur Instagram pour récupérer vos photos."
              : isNotFound
              ? "Ce lien n'existe pas ou n'a pas encore été activé par l'administrateur."
              : String(error)}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://www.instagram.com/no_photo_pix/"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="download-contact-link"
              className="inline-flex items-center gap-3 bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white px-5 py-3 rounded-full hover:brightness-110 transition text-sm"
            >
              Contacter @no_photo_pix
            </a>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-white/60 hover:text-white text-eyebrow transition-colors"
            >
              <ArrowLeft size={14} /> Retour à la galerie
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const photos = Array.isArray(data?.photos) ? data.photos : [];
  const expiresAt = data?.expires_at ? new Date(data.expires_at) : null;
  const validatedAt = data?.validated_at ? new Date(data.validated_at) : null;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Header />

      <div className="max-w-5xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 bg-emerald-400/10 border border-emerald-400/40">
            <CheckCircle size={36} weight="fill" className="text-emerald-400" />
          </div>
          <p className="text-eyebrow text-[#E8B23A] mb-4">
            No.Photo.Pix · Téléchargement
          </p>
          <h1
            data-testid="download-title"
            className="font-display text-5xl sm:text-6xl text-white leading-[0.95]"
          >
            Vos photos sont prêtes
          </h1>
          <p className="text-white/60 text-lg mt-6 max-w-xl mx-auto leading-relaxed">
            {data?.album_name ? (
              <>
                {photos.length} photo{photos.length > 1 ? "s" : ""} de l'album{" "}
                <span className="text-white">« {data.album_name} »</span>
              </>
            ) : (
              <>
                {photos.length} photo{photos.length > 1 ? "s" : ""} en haute
                définition
              </>
            )}
            . Cliquez sur chaque image pour la télécharger.
          </p>
        </div>

        {/* Meta band */}
        <div className="border border-[#E8B23A]/20 rounded-sm bg-gradient-to-br from-[#1a1206]/30 via-[#0a0a0a] to-[#0a0a0a] p-6 lg:p-8 mb-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <p className="text-eyebrow text-white/40">Commande</p>
              <p
                data-testid="download-order-id"
                className="font-mono text-white text-sm mt-2"
              >
                #{(data?.order_id || "").slice(0, 8).toUpperCase()}
              </p>
            </div>
            <div>
              <p className="text-eyebrow text-white/40">Photos</p>
              <p className="font-display text-2xl text-white mt-1">
                {photos.length}
              </p>
            </div>
            <div>
              <p className="text-eyebrow text-white/40">Total payé</p>
              <p className="font-display text-2xl text-[#E8B23A] mt-1">
                {data?.total} €
              </p>
            </div>
            <div>
              <p className="text-eyebrow text-white/40">Expire le</p>
              <p
                data-testid="download-expires"
                className="text-white text-sm mt-2 flex items-center gap-2"
              >
                <Clock size={14} className="text-amber-400" />
                {expiresAt
                  ? expiresAt.toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </p>
            </div>
          </div>
          {data?.email && (
            <div className="mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-white/40 text-xs flex items-center gap-2">
                <EnvelopeSimple size={14} /> {data.email}
              </p>
              {validatedAt && (
                <p className="text-white/40 text-xs">
                  Validée le{" "}
                  {validatedAt.toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Photos grid */}
        <div
          data-testid="download-photos-grid"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          {photos.map((p) => (
            <a
              key={p.id}
              data-testid={`download-photo-${p.id}`}
              href={downloadFileUrl(token, p.id)}
              download
              className="group relative aspect-square bg-[#0a0a0a] overflow-hidden rounded-sm block"
            >
              <ProtectedImage
                src={downloadFileUrl(token, p.id)}
                alt={p.title || ""}
                wrapperClassName="w-full h-full"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                watermark={false}
              />
              <div className="absolute inset-0 flex items-end justify-center p-3 bg-gradient-to-t from-black/90 via-black/30 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="inline-flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full text-sm font-medium">
                  <DownloadSimple size={14} weight="bold" /> Télécharger HD
                </span>
              </div>
            </a>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-12 border border-white/10 rounded-sm p-6 bg-[#0a0a0a]">
          <p className="text-eyebrow text-[#E8B23A] mb-2">À noter</p>
          <p className="text-white/60 text-sm leading-relaxed">
            Ce lien est <strong className="text-white">strictement personnel</strong>{" "}
            et reste valable pendant <strong className="text-white">48 heures</strong>.
            Téléchargements illimités pendant cette période — pensez à enregistrer vos photos sur
            votre appareil dès maintenant. Pour toute question, contactez{" "}
            <a
              href="https://www.instagram.com/no_photo_pix/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E8B23A] hover:underline"
            >
              @no_photo_pix
            </a>{" "}
            sur Instagram.
          </p>
        </div>

        <div className="mt-12 text-center">
          <Link
            to="/"
            data-testid="download-back-home"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white text-eyebrow transition-colors"
          >
            <ArrowLeft size={14} /> Retour à la galerie
          </Link>
        </div>
      </div>
    </div>
  );
}
