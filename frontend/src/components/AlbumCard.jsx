import { Link } from "react-router-dom";
import { CalendarBlank, ImageSquare, Folder } from "@phosphor-icons/react";
import { resolveImageUrl } from "../lib/api";
import { ProtectedImage } from "./ProtectedImage";

const formatDate = (date) => {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return date;
  }
};

export const AlbumCard = ({ album, index = 0 }) => {
  const count = album.photo_count || 0;
  return (
    <Link
      to={`/album/${album.id}`}
      data-testid={`album-card-${album.id}`}
      className="group relative block bg-[#0a0a0a] rounded-sm overflow-hidden border border-white/[0.06] hover:border-[#E8B23A]/50 transition-all duration-300 fade-up shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_40px_rgba(232,178,58,0.18)]"
      style={{ animationDelay: `${Math.min(index * 70, 420)}ms` }}
    >
      {/* Cover */}
      <div className="aspect-[4/3] overflow-hidden bg-[#050505] relative">
        {album.cover_url ? (
          <ProtectedImage
            src={resolveImageUrl(album.cover_url)}
            alt={album.name}
            wrapperClassName="w-full h-full"
            className="w-full h-full object-cover transition-transform duration-[800ms] ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/15 bg-gradient-to-br from-[#0a0a0a] via-[#0f0f0f] to-[#050505]">
            <Folder size={42} weight="thin" />
            <p className="text-eyebrow mt-3 text-white/30">Album vide</p>
          </div>
        )}
        {/* Bottom gradient for text readability inside cover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />

        {/* Photo count chip */}
        <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 bg-black/70 backdrop-blur-md text-white/90 px-2.5 py-1 rounded-full text-[11px] tracking-wider border border-white/10">
          <ImageSquare size={11} weight="fill" />
          <span data-testid={`album-count-${album.id}`}>{count}</span>
        </div>

        {/* Date chip on cover bottom-left */}
        {album.date && (
          <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 text-white/85 text-[11px] tracking-wider">
            <CalendarBlank size={11} weight="bold" className="text-[#E8B23A]" />
            {formatDate(album.date)}
          </div>
        )}

        {/* Title overlay on cover */}
        <div className="absolute inset-x-0 bottom-10 px-4">
          <h3
            data-testid={`album-name-${album.id}`}
            className="font-display text-2xl sm:text-3xl text-white leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] group-hover:text-[#E8B23A] transition-colors duration-300"
          >
            {album.name}
          </h3>
        </div>
      </div>

      {/* Footer line */}
      <div className="px-5 py-3 flex items-center justify-between border-t border-white/5">
        <span className="text-white/40 text-xs">
          {count > 0 ? `${count} cliché${count > 1 ? "s" : ""}` : "Bientôt"}
        </span>
        <span className="text-eyebrow text-[#E8B23A]/80 group-hover:text-[#E8B23A] transition-colors">
          Voir l'album →
        </span>
      </div>
    </Link>
  );
};

export const AlbumsGrid = ({ albums }) => {
  if (!Array.isArray(albums) || albums.length === 0) return null;
  return (
    <div
      data-testid="albums-grid"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 lg:gap-6"
    >
      {albums.map((a, i) => (
        <AlbumCard key={a.id} album={a} index={i} />
      ))}
    </div>
  );
};
