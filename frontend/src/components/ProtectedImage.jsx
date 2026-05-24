import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon } from "@phosphor-icons/react";

/**
 * ProtectedImage — production-grade image renderer for No.Photo.Pix.
 *
 * Responsibilities:
 *  - Show a premium dark/gold skeleton while loading.
 *  - Fade-in the <img> once decoded (no flash on cache-hit).
 *  - Disable right-click, drag, selection, callout (anti-grab).
 *  - Overlay a watermark layer (gold/white NPP) when `watermark` is true.
 *  - Auto-retry on error once (cache-buster) before falling back to a premium
 *    placeholder — never the browser's broken-image icon.
 *
 * Props:
 *   src          — image URL (already resolved to an absolute fetchable URL)
 *   alt          — alt text
 *   className    — classes applied to the <img>
 *   wrapperClassName — classes applied to the wrapping <div>
 *   aspectRatio  — optional CSS aspect-ratio for the wrapper
 *   watermark    — render the diagonal NPP overlay (default true)
 *   onLoad       — fwd
 *   testId       — data-testid on the wrapper
 *   imgProps     — extra props for the <img>
 */
export const ProtectedImage = ({
  src,
  alt = "",
  className = "",
  wrapperClassName = "",
  aspectRatio,
  watermark = true,
  onLoad,
  testId,
  imgProps = {},
}) => {
  const [status, setStatus] = useState("loading"); // loading | loaded | error
  const [currentSrc, setCurrentSrc] = useState(src || "");
  const retriedRef = useRef(false);

  // Reset when src changes
  useEffect(() => {
    retriedRef.current = false;
    setStatus(src ? "loading" : "error");
    setCurrentSrc(src || "");
  }, [src]);

  const handleContext = (e) => {
    e.preventDefault();
    return false;
  };
  const handleDrag = (e) => {
    e.preventDefault();
    return false;
  };

  const handleLoad = (e) => {
    setStatus("loaded");
    if (onLoad) onLoad(e);
  };

  const handleError = () => {
    if (!retriedRef.current && src) {
      // Retry once with a cache-busting param — fixes flaky CDN edges and mobile
      // browsers that bail on the first SSL handshake hiccup.
      retriedRef.current = true;
      const sep = src.includes("?") ? "&" : "?";
      setCurrentSrc(`${src}${sep}_r=${Date.now()}`);
      setStatus("loading");
      return;
    }
    setStatus("error");
  };

  const wrapperStyle = aspectRatio ? { aspectRatio } : undefined;

  return (
    <div
      data-testid={testId}
      className={`protected-img relative overflow-hidden ${wrapperClassName}`}
      style={wrapperStyle}
      onContextMenu={handleContext}
      onDragStart={handleDrag}
    >
      {/* Skeleton — premium dark/gold pulse */}
      {status === "loading" && (
        <div
          aria-hidden="true"
          className="absolute inset-0 protected-skeleton"
        />
      )}

      {/* The actual image */}
      {status !== "error" && currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onContextMenu={handleContext}
          onDragStart={handleDrag}
          onLoad={handleLoad}
          onError={handleError}
          className={`select-none ${className} ${
            status === "loaded" ? "opacity-100" : "opacity-0"
          } transition-opacity duration-500 ease-out`}
          style={{
            WebkitUserDrag: "none",
            WebkitTouchCallout: "none",
            userSelect: "none",
          }}
          {...imgProps}
        />
      )}

      {/* Premium error placeholder — never the browser's broken icon */}
      {status === "error" && (
        <div
          data-testid={testId ? `${testId}-error` : undefined}
          className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#0a0a0a] via-[#0f0a05] to-[#050505] text-white/30"
        >
          <ImageIcon size={36} weight="thin" className="text-[#E8B23A]/40" />
          <p className="mt-3 text-[10px] tracking-[0.28em] uppercase">
            Image indisponible
          </p>
        </div>
      )}

      {/* Watermark — only when image is actually loaded */}
      {watermark && status === "loaded" && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none watermark-layer"
        />
      )}
    </div>
  );
};
