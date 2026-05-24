import { useState } from "react";
import { Heart } from "@phosphor-icons/react";
import { resolveImageUrl } from "../lib/api";
import { ProtectedImage } from "./ProtectedImage";

export const PhotoCard = ({ photo, selected, onToggle, index }) => {
  const [popping, setPopping] = useState(false);

  const handleToggle = (e) => {
    e.stopPropagation();
    setPopping(true);
    setTimeout(() => setPopping(false), 400);
    onToggle(photo.id);
  };

  return (
    <div
      data-testid={`photo-card-${photo.id}`}
      className="masonry-item relative group overflow-hidden bg-[#0a0a0a] rounded-sm cursor-pointer fade-up"
      style={{ animationDelay: `${Math.min(index * 60, 600)}ms` }}
      onClick={handleToggle}
    >
      {/* Image */}
      <div className="relative overflow-hidden">
        <ProtectedImage
          src={resolveImageUrl(photo.url)}
          alt={photo.title || "Photo"}
          wrapperClassName="w-full"
          className={`w-full h-auto block transition-transform duration-700 ease-out ${
            selected ? "scale-[1.02]" : "group-hover:scale-105"
          }`}
        />

        {/* Dark overlay on hover */}
        <div
          className={`absolute inset-0 transition-colors duration-300 ${
            selected ? "bg-black/20" : "bg-black/0 group-hover:bg-black/30"
          }`}
        />

        {/* Selected ring */}
        {selected && (
          <div className="absolute inset-0 ring-1 ring-inset ring-white/60 pointer-events-none" />
        )}

        {/* Heart button */}
        <button
          data-testid={`photo-heart-${photo.id}`}
          aria-label={selected ? "Désélectionner" : "Sélectionner"}
          aria-pressed={selected}
          onClick={handleToggle}
          className={`absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full transition-all duration-300 ${
            selected
              ? "bg-white text-black opacity-100"
              : "bg-black/40 backdrop-blur-md text-white opacity-0 group-hover:opacity-100"
          } ${popping ? "heart-pop" : ""}`}
        >
          <Heart
            size={20}
            weight={selected ? "fill" : "regular"}
          />
        </button>

        {/* Title bottom-left */}
        <div
          className={`absolute bottom-0 left-0 right-0 px-4 py-3 transition-opacity duration-300 ${
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%)",
          }}
        >
          <p className="text-white text-sm font-light tracking-wide">
            {photo.title || "Sans titre"}
          </p>
          <p className="text-white/50 text-xs uppercase tracking-[0.2em] mt-0.5">
            3 € · {selected ? "Sélectionné" : "Cliquer pour sélectionner"}
          </p>
        </div>
      </div>
    </div>
  );
};
