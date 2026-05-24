import { useEffect, useState, useCallback } from "react";
import { X, CaretLeft, CaretRight, Heart, DownloadSimple } from "@phosphor-icons/react";
import { resolveImageUrl } from "../lib/api";
import { ProtectedImage } from "./ProtectedImage";

/**
 * Fullscreen photo lightbox.
 * Props:
 *  - photos: Array of photos
 *  - index: current index (null = closed)
 *  - onClose
 *  - onNavigate(newIndex)
 *  - selectedIds: Set of photo ids (optional — enables heart toggle)
 *  - onToggleSelect(photoId) (optional)
 *  - allowDownload (default false)
 */
export const Lightbox = ({
  photos,
  index,
  onClose,
  onNavigate,
  selectedIds,
  onToggleSelect,
  allowDownload = false,
}) => {
  const open = typeof index === "number" && Array.isArray(photos) && photos[index];
  const [loaded, setLoaded] = useState(false);

  const photo = open ? photos[index] : null;
  const total = Array.isArray(photos) ? photos.length : 0;
  const canPrev = open && index > 0;
  const canNext = open && index < total - 1;

  const handlePrev = useCallback(() => {
    if (canPrev) onNavigate(index - 1);
  }, [canPrev, index, onNavigate]);

  const handleNext = useCallback(() => {
    if (canNext) onNavigate(index + 1);
  }, [canNext, index, onNavigate]);

  useEffect(() => {
    if (!open) return;
    setLoaded(false);
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "ArrowRight") handleNext();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, handlePrev, handleNext]);

  if (!open) return null;

  const selected = selectedIds && selectedIds.has(photo.id);
  const src = resolveImageUrl(photo.url);

  return (
    <div
      data-testid="lightbox"
      className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-sm flex items-center justify-center select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={photo.title || "Photo"}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 sm:px-8 py-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <div className="text-white/70 text-sm tracking-wider pointer-events-auto">
          <span data-testid="lightbox-counter" className="font-mono">
            {index + 1} / {total}
          </span>
          {photo.title && (
            <span className="ml-4 text-white/40 hidden sm:inline">· {photo.title}</span>
          )}
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          {onToggleSelect && (
            <button
              data-testid="lightbox-heart-btn"
              aria-pressed={selected}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(photo.id);
              }}
              className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors ${
                selected
                  ? "bg-[#E8B23A] text-black"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
              title={selected ? "Désélectionner" : "Sélectionner pour achat"}
            >
              <Heart size={18} weight={selected ? "fill" : "regular"} />
            </button>
          )}
          {allowDownload && (
            <a
              data-testid="lightbox-download"
              href={src}
              download={photo.title || "photo"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              title="Télécharger"
            >
              <DownloadSimple size={18} />
            </a>
          )}
          <button
            data-testid="lightbox-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Prev */}
      {canPrev && (
        <button
          data-testid="lightbox-prev"
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          aria-label="Précédente"
          className="absolute left-2 sm:left-6 z-10 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-white transition-colors"
        >
          <CaretLeft size={22} weight="bold" />
        </button>
      )}

      {/* Next */}
      {canNext && (
        <button
          data-testid="lightbox-next"
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          aria-label="Suivante"
          className="absolute right-2 sm:right-6 z-10 w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-white transition-colors"
        >
          <CaretRight size={22} weight="bold" />
        </button>
      )}

      {/* Image */}
      <div
        className="relative w-full h-full flex items-center justify-center px-4 sm:px-20 py-20"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white/30 text-sm">Chargement...</div>
          </div>
        )}
        <ProtectedImage
          key={photo.id}
          src={src}
          alt={photo.title || "Photo"}
          wrapperClassName="max-w-full max-h-full flex items-center justify-center"
          className={`max-w-full max-h-[80vh] object-contain transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          watermark={!allowDownload}
          onLoad={() => setLoaded(true)}
        />
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-[10px] tracking-[0.3em] uppercase pointer-events-none">
        ← → · Esc pour fermer
      </div>
    </div>
  );
};
