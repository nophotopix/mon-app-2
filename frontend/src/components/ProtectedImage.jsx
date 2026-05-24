import { useState } from "react";

/**
 * ProtectedImage
 * - Renders an <img> with an SVG watermark overlay ("NPP" diagonal, gold/white)
 * - Disables right-click, drag-start, selection
 * - Lazy-loads
 * Props:
 *   src         (string) image URL
 *   alt         (string)
 *   className   (string) classes for the <img>
 *   wrapperClassName (string) classes for the wrapping <div>
 *   aspectRatio (string)  e.g. "1/1", "3/4" — optional, sets wrapper aspect-ratio
 *   watermark   (bool, default true)
 *   onLoad      (fn)
 *   testId      (string) data-testid on the wrapper
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
  const [loaded, setLoaded] = useState(false);

  const handleContext = (e) => {
    e.preventDefault();
    return false;
  };
  const handleDrag = (e) => {
    e.preventDefault();
    return false;
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
      {!loaded && (
        <div className="absolute inset-0 bg-[#0f0f0f] animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        draggable={false}
        onContextMenu={handleContext}
        onDragStart={handleDrag}
        onLoad={(e) => {
          setLoaded(true);
          if (onLoad) onLoad(e);
        }}
        onError={() => setLoaded(true)}
        className={`select-none ${className}`}
        style={{
          WebkitUserDrag: "none",
          WebkitTouchCallout: "none",
          userSelect: "none",
        }}
        {...imgProps}
      />

      {watermark && loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none watermark-layer"
        />
      )}
    </div>
  );
};
