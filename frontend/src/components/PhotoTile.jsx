import { Heart } from "@phosphor-icons/react";
import { resolveImageUrl } from "../lib/api";

/**
 * Square photo tile for grid layouts (Album page, gallery photo lists).
 * - Click on image body  -> onOpen(index)  (opens lightbox)
 * - Click on heart icon  -> onToggle(id)   (select for purchase)
 */
export const PhotoTile = ({ photo, index, selected, onOpen, onToggle }) => {
  return (
    <div
      data-testid={`photo-tile-${photo.id}`}
      className="group relative aspect-square overflow-hidden bg-[#0a0a0a] rounded-sm cursor-pointer fade-up"
      style={{ animationDelay: `${Math.min(index * 40, 480)}ms` }}
      onClick={(e) => {
        e.stopPropagation();
        if (onOpen) onOpen(index);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onOpen) onOpen(index);
      }}
      aria-label={photo.title || "Photo"}
    >
      <img
        src={resolveImageUrl(photo.url)}
        alt={photo.title || "Photo"}
        loading="lazy"
        className={`w-full h-full object-cover transition-transform duration-700 ease-out ${
          selected ? "scale-[1.02]" : "group-hover:scale-105"
        }`}
        draggable={false}
      />

      {/* Hover/selected dark overlay */}
      <div
        className={`absolute inset-0 transition-colors duration-300 pointer-events-none ${
          selected ? "bg-black/20" : "bg-black/0 group-hover:bg-black/30"
        }`}
      />

      {/* Selected gold ring */}
      {selected && (
        <div className="absolute inset-0 ring-2 ring-inset ring-[#E8B23A]/80 pointer-events-none" />
      )}

      {/* Heart button (top-right) */}
      <button
        data-testid={`photo-heart-${photo.id}`}
        aria-label={selected ? "Désélectionner" : "Sélectionner"}
        aria-pressed={selected}
        onClick={(e) => {
          e.stopPropagation();
          if (onToggle) onToggle(photo.id);
        }}
        className={`absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 ${
          selected
            ? "bg-[#E8B23A] text-black opacity-100 shadow-[0_4px_16px_rgba(232,178,58,0.5)]"
            : "bg-black/40 backdrop-blur-md text-white opacity-0 group-hover:opacity-100"
        }`}
      >
        <Heart size={18} weight={selected ? "fill" : "regular"} />
      </button>

      {/* Price chip (bottom-left) revealed on hover/select */}
      <div
        className={`absolute bottom-3 left-3 transition-opacity duration-300 pointer-events-none ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <span className="inline-flex items-center bg-black/70 backdrop-blur-md text-white text-xs px-2.5 py-1 rounded-sm tracking-wider">
          3 €
        </span>
      </div>
    </div>
  );
};
