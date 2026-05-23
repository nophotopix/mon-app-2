import { Link } from "react-router-dom";
import { Folder, CalendarBlank, ImageSquare } from "@phosphor-icons/react";
import { resolveImageUrl } from "../lib/api";

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

export const AlbumCard = ({ album, index = 0 }) => {
  const count = album.photo_count || 0;
  return (
    <Link
      to={`/album/${album.id}`}
      data-testid={`album-card-${album.id}`}
      className="group relative block bg-[#0a0a0a] rounded-sm overflow-hidden border border-white/5 hover:border-[#E8B23A]/40 transition-all fade-up"
      style={{ animationDelay: `${Math.min(index * 80, 480)}ms` }}
    >
      <div className="aspect-[4/3] overflow-hidden bg-[#050505] relative">
        {album.cover_url ? (
          <img
            src={resolveImageUrl(album.cover_url)}
            alt={album.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
            <Folder size={48} weight="thin" />
            <p className="text-eyebrow mt-3">Album vide</p>
          </div>
        )}
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-90 transition-opacity" />
        {/* Photo count chip */}
        <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 bg-black/60 backdrop-blur-md text-white/80 px-2.5 py-1 rounded-sm text-xs">
          <ImageSquare size={12} weight="fill" />
          <span data-testid={`album-count-${album.id}`}>{count}</span>
        </div>
      </div>
      <div className="p-5">
        <h3
          data-testid={`album-name-${album.id}`}
          className="font-display text-2xl text-white leading-tight group-hover:text-[#E8B23A] transition-colors"
        >
          {album.name}
        </h3>
        {album.date && (
          <p className="text-white/50 text-xs mt-2 flex items-center gap-1.5">
            <CalendarBlank size={12} />
            {formatDate(album.date)}
          </p>
        )}
        {album.description && (
          <p className="text-white/40 text-sm mt-3 line-clamp-2">
            {album.description}
          </p>
        )}
      </div>
    </Link>
  );
};

export const AlbumsGrid = ({ albums }) => {
  if (!Array.isArray(albums) || albums.length === 0) return null;
  return (
    <div
      data-testid="albums-grid"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      {albums.map((a, i) => (
        <AlbumCard key={a.id} album={a} index={i} />
      ))}
    </div>
  );
};
