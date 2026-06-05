import { useEffect, useRef, useState } from "react";
import { Header } from "../components/Header";
import {
  adminLogin,
  createAlbum,
  deleteAlbum,
  deletePhoto,
  deleteOrder,
  fetchAdminOrders,
  fetchAlbum,
  fetchAlbums,
  fetchPhotos,
  resolveImageUrl,
  updateAlbum,
  uploadPhoto,
  uploadPhotoToAlbum,
  resendOrderLink,
  verifyOrder,
  refuseOrder,
} from "../lib/api";
import { PaymentMethodIcon } from "../components/PaymentIcons";
import { ProtectedImage } from "../components/ProtectedImage";
import { toast } from "sonner";
import {
  UploadSimple,
  Trash,
  LockKey,
  SignOut,
  CheckCircle,
  Clock,
  EnvelopeSimple,
  Image as ImageIcon,
  ShoppingBag,
  PaperPlaneTilt,
  Folder,
  FolderPlus,
  ArrowLeft,
  CalendarBlank,
  Star,
  Copy,
  WarningCircle,
  LinkSimple,
} from "@phosphor-icons/react";

const TOKEN_KEY = "nophotopix_admin_token";

export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState("albums"); // albums | photos | orders
  const [photos, setPhotos] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [validatingId, setValidatingId] = useState(null);
  const fileInputRef = useRef(null);

  const loadPhotos = async () => {
    try {
      const data = await fetchPhotos();
      setPhotos(Array.isArray(data) ? data : []);
    } catch {
      setPhotos([]);
      toast.error("Erreur de chargement des photos");
    }
  };

  const loadOrders = async () => {
    try {
      const data = await fetchAdminOrders(token);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setOrders([]);
      if (err?.response?.status === 401) {
        toast.error("Session expirée");
        handleLogout();
      } else {
        toast.error("Erreur de chargement des commandes");
      }
    }
  };

  const loadAlbums = async () => {
    try {
      setAlbums(await fetchAlbums());
    } catch {
      setAlbums([]);
      toast.error("Erreur de chargement des albums");
    }
  };

  useEffect(() => {
    if (token) {
      loadAlbums();
      loadPhotos();
      loadOrders();
    }
    // eslint-disable-next-line
  }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    try {
      const res = await adminLogin(password);
      localStorage.setItem(TOKEN_KEY, res.token);
      setToken(res.token);
      toast.success("Connecté");
    } catch {
      toast.error("Mot de passe incorrect");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setPassword("");
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        if (selectedAlbumId) {
          await uploadPhotoToAlbum(file, token, selectedAlbumId);
        } else {
          await uploadPhoto(file, token);
        }
      }
      toast.success(`${files.length} photo${files.length > 1 ? "s" : ""} ajoutée${files.length > 1 ? "s" : ""}`);
      await loadPhotos();
      await loadAlbums();
    } catch (err) {
      if (err?.response?.status === 401) {
        toast.error("Session expirée");
        handleLogout();
      } else {
        toast.error("Échec de l'upload");
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer cette photo ?")) return;
    try {
      await deletePhoto(id, token);
      toast.success("Photo supprimée");
      await loadPhotos();
      await loadAlbums();
    } catch {
      toast.error("Erreur de suppression");
    }
  };

  const handleCreateAlbum = async ({ name, date, description }) => {
    try {
      await createAlbum({ name, date, description }, token);
      toast.success("Album créé");
      await loadAlbums();
      return true;
    } catch (err) {
      if (err?.response?.status === 401) {
        toast.error("Session expirée");
        handleLogout();
      } else {
        toast.error(err?.response?.data?.detail || "Erreur lors de la création");
      }
      return false;
    }
  };

  const handleDeleteAlbum = async (albumId) => {
    const hardDelete = confirm(
      "Supprimer cet album.\n\nOK = supprimer aussi toutes les photos de l'album.\nAnnuler = revenir en arrière."
    );
    if (!hardDelete) return;
    try {
      await deleteAlbum(albumId, token, true);
      toast.success("Album et ses photos supprimés");
      setSelectedAlbumId(null);
      await loadAlbums();
      await loadPhotos();
    } catch {
      toast.error("Erreur de suppression");
    }
  };

  const handleSetCover = async (albumId, photoId) => {
    try {
      await updateAlbum(albumId, { cover_photo_id: photoId }, token);
      toast.success("Couverture mise à jour");
      await loadAlbums();
    } catch {
      toast.error("Erreur de mise à jour");
    }
  };

  const handleResendLink = async (orderId) => {
    if (!confirm("Renvoyer le lien HD au client (email) ?")) return;
    setValidatingId(orderId);
    try {
      const updated = await resendOrderLink(orderId, token);
      if (updated?.email_sent) {
        toast.success("Lien renvoyé · email envoyé au client", { duration: 6000 });
      } else if (updated?.email_error) {
        toast.warning(`Email NON envoyé. Détail : ${updated.email_error}`, { duration: 14000 });
      } else {
        toast.success("Lien renvoyé");
      }
      await loadOrders();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        toast.error("Session expirée");
        handleLogout();
      } else {
        toast.error("Erreur de renvoi");
      }
    } finally {
      setValidatingId(null);
    }
  };

  const handleVerifyOrder = async (orderId) => {
    if (!confirm("Marquer cette commande comme vérifiée ?")) return;
    try {
      await verifyOrder(orderId, token);
      toast.success("Commande vérifiée");
      await loadOrders();
    } catch {
      toast.error("Erreur de vérification");
    }
  };

  const handleRefuseOrder = async (orderId) => {
    if (!confirm("Refuser cette commande ? (le lien HD sera désactivé)")) return;
    try {
      await refuseOrder(orderId, token);
      toast.success("Commande refusée");
      await loadOrders();
    } catch {
      toast.error("Erreur de refus");
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-6">
          <form
            data-testid="admin-login-form"
            onSubmit={handleLogin}
            className="w-full max-w-md"
          >
            <div className="text-center mb-10">
              <div className="w-14 h-14 mx-auto mb-6 rounded-full border border-white/10 flex items-center justify-center">
                <LockKey size={22} className="text-white/70" />
              </div>
              <p className="text-eyebrow text-white/40">Espace privé</p>
              <h1 className="font-display text-4xl text-white mt-3">
                Connexion admin
              </h1>
              <p className="text-white/50 text-sm mt-3">
                Entrez votre mot de passe pour gérer la galerie
              </p>
            </div>
            <div className="space-y-4">
              <input
                data-testid="admin-password-input"
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/10 focus:border-white/40 outline-none text-white px-4 py-4 rounded-sm transition-colors"
                autoFocus
              />
              <button
                data-testid="admin-login-btn"
                type="submit"
                disabled={loggingIn || !password}
                className="w-full bg-white text-black py-4 rounded-sm hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm tracking-wide font-medium"
              >
                {loggingIn ? "Connexion..." : "Se connecter"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      <Header />
      <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
          <div>
            <p className="text-eyebrow text-white/40">Tableau de bord</p>
            <h1 className="font-display text-4xl sm:text-5xl text-white mt-2">
              Gestion No.Photo.Pix
            </h1>
            <p className="text-white/50 text-sm mt-3">
              {photos.length} photo{photos.length > 1 ? "s" : ""} ·{" "}
              {orders.length} commande{orders.length > 1 ? "s" : ""}
            </p>
          </div>
          <button
            data-testid="admin-logout-btn"
            onClick={handleLogout}
            className="flex items-center gap-2 text-white/60 hover:text-white text-eyebrow self-start sm:self-end transition-colors"
          >
            <SignOut size={14} /> Déconnexion
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/10 mb-10">
          <button
            data-testid="tab-albums"
            onClick={() => {
              setTab("albums");
              setSelectedAlbumId(null);
            }}
            className={`flex items-center gap-2 px-5 py-3 text-sm transition-colors border-b-2 -mb-px ${
              tab === "albums"
                ? "border-[#E8B23A] text-white"
                : "border-transparent text-white/50 hover:text-white"
            }`}
          >
            <Folder size={16} /> Albums ({albums.length})
          </button>
          <button
            data-testid="tab-photos"
            onClick={() => setTab("photos")}
            className={`flex items-center gap-2 px-5 py-3 text-sm transition-colors border-b-2 -mb-px ${
              tab === "photos"
                ? "border-[#E8B23A] text-white"
                : "border-transparent text-white/50 hover:text-white"
            }`}
          >
            <ImageIcon size={16} /> Toutes les photos ({photos.length})
          </button>
          <button
            data-testid="tab-orders"
            onClick={() => setTab("orders")}
            className={`flex items-center gap-2 px-5 py-3 text-sm transition-colors border-b-2 -mb-px ${
              tab === "orders"
                ? "border-[#E8B23A] text-white"
                : "border-transparent text-white/50 hover:text-white"
            }`}
          >
            <ShoppingBag size={16} /> Commandes ({orders.length})
            {orders.filter((o) => o.status === "pending").length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400 text-[10px]">
                {orders.filter((o) => o.status === "pending").length} nouv.
              </span>
            )}
          </button>
        </div>

        {tab === "albums" && !selectedAlbumId && (
          <AlbumsTab
            albums={albums}
            onCreate={handleCreateAlbum}
            onOpen={(id) => setSelectedAlbumId(id)}
            onDelete={handleDeleteAlbum}
          />
        )}
        {tab === "albums" && selectedAlbumId && (
          <AlbumDetailTab
            albumId={selectedAlbumId}
            token={token}
            uploading={uploading}
            fileInputRef={fileInputRef}
            handleUpload={handleUpload}
            handleDelete={handleDelete}
            handleSetCover={handleSetCover}
            handleDeleteAlbum={handleDeleteAlbum}
            onBack={() => setSelectedAlbumId(null)}
          />
        )}
        {tab === "photos" && (
          <PhotosTab
            photos={photos}
            uploading={uploading}
            fileInputRef={fileInputRef}
            handleUpload={handleUpload}
            handleDelete={handleDelete}
          />
        )}
        {tab === "orders" && (
          <OrdersTab
            orders={orders}
            actioningId={validatingId}
            onResend={handleResendLink}
            onVerify={handleVerifyOrder}
            onRefuse={handleRefuseOrder}
            onRefresh={loadOrders}
          />
        )}
      </div>
    </div>
  );
}

const AlbumsTab = ({ albums, onCreate, onOpen, onDelete }) => {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    const ok = await onCreate({ name, date, description });
    if (ok) {
      setName("");
      setDate("");
      setDescription("");
      setShowForm(false);
    }
    setSubmitting(false);
  };

  return (
    <div>
      <div className="flex justify-between items-end mb-8">
        <p className="text-eyebrow text-white/40">Tous les albums</p>
        <button
          data-testid="create-album-btn"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-[#E8B23A] via-[#FFD66B] to-[#C8902A] text-black px-4 py-2.5 rounded-sm font-medium text-sm hover:brightness-110 transition"
        >
          <FolderPlus size={16} weight="bold" />
          {showForm ? "Annuler" : "Créer un album"}
        </button>
      </div>

      {showForm && (
        <form
          data-testid="create-album-form"
          onSubmit={submit}
          className="border border-[#E8B23A]/30 bg-gradient-to-br from-[#1a1206]/40 via-[#0a0a0a] to-[#0a0a0a] rounded-sm p-6 mb-10"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-eyebrow text-white/40 block mb-2">
                Nom de l'événement *
              </label>
              <input
                data-testid="album-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Match du 18 mai 2026"
                className="w-full bg-[#050505] border border-white/10 focus:border-[#E8B23A]/60 outline-none text-white px-4 py-3 rounded-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="text-eyebrow text-white/40 block mb-2">Date</label>
              <input
                data-testid="album-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#050505] border border-white/10 focus:border-[#E8B23A]/60 outline-none text-white px-4 py-3 rounded-sm"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="text-eyebrow text-white/40 block mb-2">
              Description (optionnel)
            </label>
            <textarea
              data-testid="album-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Quelques mots sur l'événement..."
              className="w-full bg-[#050505] border border-white/10 focus:border-[#E8B23A]/60 outline-none text-white px-4 py-3 rounded-sm resize-none"
            />
          </div>
          <button
            data-testid="submit-album-btn"
            type="submit"
            disabled={!name.trim() || submitting}
            className="mt-4 bg-white text-black px-5 py-2.5 rounded-sm font-medium text-sm hover:bg-white/90 transition disabled:opacity-30"
          >
            {submitting ? "Création..." : "Créer l'album"}
          </button>
        </form>
      )}

      {albums.length === 0 ? (
        <div
          data-testid="admin-no-albums"
          className="border border-white/10 rounded-sm p-16 text-center text-white/40"
        >
          <Folder size={32} weight="thin" className="mx-auto mb-3 text-white/30" />
          Aucun album pour le moment
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums.map((a) => (
            <div
              key={a.id}
              data-testid={`admin-album-card-${a.id}`}
              className="group relative bg-[#0a0a0a] border border-white/10 hover:border-[#E8B23A]/40 rounded-sm overflow-hidden transition-colors"
            >
              <button
                onClick={() => onOpen(a.id)}
                className="block w-full text-left"
              >
                <div className="aspect-[4/3] bg-[#050505] overflow-hidden">
                  {a.cover_url ? (
                    <img
                      src={a.cover_url}
                      alt={a.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20">
                      <Folder size={36} weight="thin" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-display text-xl text-white">{a.name}</h3>
                  {a.date && (
                    <p className="text-white/40 text-xs mt-1 flex items-center gap-1">
                      <CalendarBlank size={11} />
                      {a.date}
                    </p>
                  )}
                  <p className="text-white/50 text-xs mt-2">
                    {a.photo_count} photo{a.photo_count > 1 ? "s" : ""}
                  </p>
                </div>
              </button>
              <button
                data-testid={`delete-album-${a.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(a.id);
                }}
                title="Supprimer l'album"
                className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 backdrop-blur text-white/60 hover:text-red-400 hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AlbumDetailTab = ({
  albumId,
  uploading,
  fileInputRef,
  handleUpload,
  handleDelete,
  handleSetCover,
  handleDeleteAlbum,
  onBack,
}) => {
  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    try {
      const data = await fetchAlbum(albumId);
      setAlbum(data);
    } catch {
      toast.error("Erreur de chargement de l'album");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    reload();
    // eslint-disable-next-line
  }, [albumId, uploading]);

  if (loading || !album) {
    return (
      <div className="text-center text-white/40 py-12">Chargement...</div>
    );
  }

  const photos = Array.isArray(album.photos) ? album.photos : [];

  return (
    <div>
      <button
        data-testid="admin-back-to-albums"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-white/60 hover:text-white text-eyebrow mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Tous les albums
      </button>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
        <div>
          <p className="text-eyebrow text-[#E8B23A]">Album</p>
          <h2
            data-testid="admin-album-detail-name"
            className="font-display text-4xl text-white mt-2"
          >
            {album.name}
          </h2>
          <p className="text-white/40 text-sm mt-2">
            {album.date && (
              <>
                <CalendarBlank size={12} className="inline mr-1" />
                {album.date} ·{" "}
              </>
            )}
            {photos.length} photo{photos.length > 1 ? "s" : ""}
          </p>
        </div>
        <button
          data-testid="admin-album-delete-btn"
          onClick={() => handleDeleteAlbum(albumId)}
          className="text-red-400/80 hover:text-red-400 text-eyebrow flex items-center gap-2 transition-colors"
        >
          <Trash size={14} /> Supprimer l'album
        </button>
      </div>

      {/* Upload zone scoped to this album */}
      <label
        data-testid="album-upload-zone"
        className={`block border border-dashed rounded-sm p-10 text-center cursor-pointer transition-colors ${
          uploading
            ? "border-[#E8B23A]/40 bg-[#E8B23A]/[0.05]"
            : "border-white/10 hover:border-[#E8B23A]/40 hover:bg-white/[0.02]"
        }`}
      >
        <input
          ref={fileInputRef}
          data-testid="album-upload-input"
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
        <UploadSimple size={32} className="mx-auto text-[#E8B23A]" weight="thin" />
        <p className="font-display text-xl text-white mt-3">
          {uploading ? "Téléchargement..." : `Ajouter des photos à "${album.name}"`}
        </p>
        <p className="text-white/40 text-sm mt-1">
          JPG, PNG, WEBP · plusieurs fichiers possibles
        </p>
      </label>

      <div className="mt-10">
        {photos.length === 0 ? (
          <div className="border border-white/10 rounded-sm p-16 text-center text-white/40">
            Pas encore de photos dans cet album
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {photos.map((p) => {
              const isCover = p.id === album.cover_photo_id;
              return (
                <div
                  key={p.id}
                  data-testid={`admin-album-photo-${p.id}`}
                  className="group relative aspect-square bg-[#0a0a0a] overflow-hidden rounded-sm"
                >
                  <ProtectedImage
                    src={resolveImageUrl(p.url)}
                    alt={p.title || ""}
                    wrapperClassName="w-full h-full"
                    className="w-full h-full object-cover"
                    watermark={true}
                  />
                  {isCover && (
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-sm bg-[#E8B23A] text-black font-semibold">
                      <Star size={10} weight="fill" /> Couverture
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-colors flex items-center justify-center gap-2 p-2">
                    {!isCover && (
                      <button
                        data-testid={`set-cover-${p.id}`}
                        onClick={async () => {
                          await handleSetCover(albumId, p.id);
                          reload();
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white text-black px-3 py-2 rounded-sm flex items-center gap-1 text-xs"
                        title="Définir comme couverture"
                      >
                        <Star size={12} /> Couverture
                      </button>
                    )}
                    <button
                      data-testid={`delete-album-photo-${p.id}`}
                      onClick={async () => {
                        await handleDelete(p.id);
                        reload();
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-black px-3 py-2 rounded-sm flex items-center gap-1 text-xs"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const PhotosTab = ({ photos, uploading, fileInputRef, handleUpload, handleDelete }) => (
  <>
    {/* Upload zone */}
    <label
      data-testid="upload-zone"
      className={`block border border-dashed rounded-sm p-12 text-center cursor-pointer transition-colors ${
        uploading
          ? "border-white/30 bg-white/5"
          : "border-white/10 hover:border-white/30 hover:bg-white/[0.02]"
      }`}
    >
      <input
        ref={fileInputRef}
        data-testid="upload-input"
        type="file"
        accept="image/*"
        multiple
        onChange={handleUpload}
        disabled={uploading}
        className="hidden"
      />
      <UploadSimple size={36} className="mx-auto text-white/40" weight="thin" />
      <p className="font-display text-2xl text-white mt-4">
        {uploading ? "Téléchargement..." : "Ajouter des photos"}
      </p>
      <p className="text-white/40 text-sm mt-2">
        Cliquez pour sélectionner des fichiers (JPG, PNG, WEBP)
      </p>
    </label>

    {/* Photos grid */}
    <div className="mt-16">
      <p className="text-eyebrow text-white/40 mb-6">Photos publiées</p>
      {!Array.isArray(photos) || photos.length === 0 ? (
        <div className="border border-white/10 rounded-sm p-16 text-center text-white/40">
          Aucune photo pour le moment
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {photos.map((p) => (
            <div
              key={p.id}
              data-testid={`admin-photo-${p.id}`}
              className="group relative aspect-square bg-[#0a0a0a] overflow-hidden rounded-sm"
            >
              <ProtectedImage
                src={resolveImageUrl(p.url)}
                alt={p.title || ""}
                wrapperClassName="w-full h-full"
                className="w-full h-full object-cover"
                watermark={false}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                <button
                  data-testid={`delete-photo-${p.id}`}
                  onClick={() => handleDelete(p.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-black px-4 py-2 rounded-sm flex items-center gap-2 text-sm"
                >
                  <Trash size={14} /> Supprimer
                </button>
              </div>
              <span className="absolute top-2 left-2 text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-sm bg-black/60 text-white/80">
                {p.source === "upload" ? "Upload" : "Demo"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  </>
);

const DownloadLinkBand = ({ downloadUrl, emailSent, emailError, expiresAt }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopied(true);
      toast.success("Lien HD copié dans le presse-papier");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for old browsers / iOS Safari without clipboard permission
      const el = document.createElement("textarea");
      el.value = downloadUrl;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      document.body.removeChild(el);
      setCopied(true);
      toast.success("Lien HD copié");
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const expiresDate = expiresAt ? new Date(expiresAt) : null;
  const expiresStr = expiresDate
    ? expiresDate.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })
    : null;

  return (
    <div
      data-testid="admin-download-link-band"
      className={`mt-4 pt-4 border-t ${
        emailSent ? "border-emerald-400/20" : "border-amber-400/30"
      }`}
    >
      {!emailSent && (
        <div
          data-testid="admin-email-error"
          className="mb-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-sm flex items-start gap-3"
        >
          <WarningCircle size={18} weight="fill" className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-100/90 leading-relaxed">
            <p className="font-medium text-amber-200">Email NON envoyé.</p>
            <p className="mt-1 text-xs text-amber-100/70">
              {emailError || "Aucune raison fournie."} Copie le lien HD ci-dessous et envoie-le manuellement au client via WhatsApp, SMS, Instagram, etc.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-eyebrow text-[#E8B23A] mb-1">Lien HD sécurisé · 48h</p>
          <div className="flex items-center gap-2">
            <LinkSimple size={14} className="text-white/40 shrink-0" />
            <code
              data-testid="admin-download-url"
              className="text-white/70 text-xs font-mono truncate"
              title={downloadUrl}
            >
              {downloadUrl}
            </code>
          </div>
          {expiresStr && (
            <p className="text-white/40 text-[11px] mt-1">Expire le {expiresStr}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="admin-copy-link-btn"
            onClick={handleCopy}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-sm text-sm font-medium transition ${
              copied
                ? "bg-emerald-500 text-black"
                : "bg-white text-black hover:brightness-95"
            }`}
          >
            {copied ? (
              <>
                <CheckCircle size={14} weight="bold" /> Copié
              </>
            ) : (
              <>
                <Copy size={14} weight="bold" /> Copier le lien
              </>
            )}
          </button>
          <a
            data-testid="admin-open-link-btn"
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm bg-white/5 text-white hover:bg-white/10 transition"
            title="Ouvrir le lien (aperçu)"
          >
            Aperçu
          </a>
        </div>
      </div>
    </div>
  );
};

const OrdersTab = ({
  orders,
  actioningId,
  onResend,
  onVerify,
  onRefuse,
  onRefresh,
}) => (
  <div>
    <div className="flex justify-between items-end mb-6">
      <p className="text-eyebrow text-white/40">Toutes les commandes</p>
      <button
        onClick={onRefresh}
        className="text-eyebrow text-white/60 hover:text-white transition-colors"
      >
        Actualiser
      </button>
    </div>
    {!Array.isArray(orders) || orders.length === 0 ? (
      <div className="border border-white/10 rounded-sm p-16 text-center text-white/40">
        Aucune commande pour le moment
      </div>
    ) : (
      <div className="space-y-4">
        {orders.map((o) => {
          const isRefused = o.status === "refused";
          const isDownloaded = !!o.downloaded_at;
          const isPending = o.status === "pending";
          const isCompleted = o.status === "completed";

          const statusLabel = isRefused
            ? "Refusé"
            : isDownloaded
              ? "Téléchargé"
              : isPending
                ? "En attente de paiement"
                : o.email_sent
                  ? "Lien envoyé"
                  : "Paiement déclaré";

          const statusColor = isRefused
            ? "text-red-400"
            : isDownloaded || (isCompleted && o.email_sent)
              ? "text-emerald-400"
              : "text-amber-400";

          const StatusIcon = isRefused
            ? Clock
            : isDownloaded || (isCompleted && o.email_sent)
              ? CheckCircle
              : Clock;

          return (
            <div
              key={o.id}
              data-testid={`admin-order-${o.id}`}
              className={`border rounded-sm p-6 transition-colors ${
                isRefused
                  ? "border-red-400/30 bg-red-400/[0.03]"
                  : isPending
                    ? "border-amber-400/30 bg-amber-400/[0.03]"
                    : "border-white/10 bg-[#0a0a0a]"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-white text-sm">
                      #{o.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className={`inline-flex items-center gap-1 ${statusColor} text-xs`}>
                      <StatusIcon size={12} weight="fill" /> {statusLabel}
                    </span>
                  </div>
                  <p className="text-white/80 text-sm flex items-center gap-2">
                    <EnvelopeSimple size={14} className="text-white/40" />
                    {o.email}
                  </p>
                  <p className="text-white/40 text-xs mt-1">
                    Album : {o.album_name || "Galerie"}
                  </p>
                  {o.phone && (
                    <p className="text-white/40 text-xs mt-1">
                      Téléphone : {o.phone}
                    </p>
                  )}
                  {o.proof && (
                    <p className="text-white/40 text-xs mt-1">
                      Preuve : {String(o.proof).slice(0, 60)}
                      {String(o.proof).length > 60 ? "…" : ""}
                    </p>
                  )}
                  <p className="text-white/40 text-xs mt-1">
                    {new Date(o.created_at).toLocaleString("fr-FR")}
                  </p>
                </div>

                <div className="flex items-center gap-4 lg:gap-6">
                  <div className="text-right">
                    <p className="text-eyebrow text-white/40">Total</p>
                    <p className="font-display text-2xl text-[#E8B23A]">
                      {o.total} €
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-eyebrow text-white/40">Photos</p>
                    <p className="font-display text-2xl text-white">
                      {o.photo_ids.length}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PaymentMethodIcon id={o.payment_method} size={28} />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 lg:min-w-[240px] lg:justify-end">
                  {!isRefused && isDownloaded && (
                    <button
                      data-testid={`resend-order-${o.id}`}
                      disabled={actioningId === o.id}
                      onClick={() => onResend(o.id)}
                      className="bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-sm font-medium text-sm transition disabled:opacity-50 flex items-center gap-2 justify-center"
                    >
                      <PaperPlaneTilt size={14} weight="bold" />
                      {actioningId === o.id ? "Envoi..." : "Renvoyer lien"}
                    </button>
                  )}
                  {true && (
                    <>
                      <button
                        data-testid={`verify-order-${o.id}`}
                        onClick={() => onVerify(o.id)}
                        className="bg-gradient-to-r from-[#E8B23A] via-[#FFD66B] to-[#C8902A] text-black px-4 py-2 rounded-sm font-medium text-sm transition-colors flex items-center gap-1 justify-center"
                      >
                        <CheckCircle size={14} weight="fill" />
                        {o.verified ? "Vérifiée" : "Transaction validée"}
                      </button>

                      <button
                        onClick={async () => {
                          if (!window.confirm("Supprimer définitivement cette commande ?")) return;

                          await deleteOrder(
                            o.id,
                            localStorage.getItem("nophotopix_admin_token")
                          );

                          sessionStorage.setItem("admin_active_tab", "orders");
                          window.location.reload();
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-sm text-sm transition-colors"
                     >
                        Supprimer
                      </button>
                    </>
                  )}

                  {!isRefused && (
                    <button
                      data-testid={`refuse-order-${o.id}`}
                      onClick={() => onRefuse(o.id)}
                      className="text-white/40 hover:text-red-400 px-3 py-2 text-sm transition-colors flex items-center gap-1 justify-center"
                      title="Refuser la commande"
                    >
                      <Trash size={14} />
                      Refuser
                    </button>
                  )}
                </div>
              </div>

              {/* Thumbnails */}
              <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-2">
                {(Array.isArray(o.photos) ? o.photos : []).slice(0, 8).map((p) => (
                  <ProtectedImage
                    key={p.id}
                    src={resolveImageUrl(p.url)}
                    alt={p.title || ""}
                    wrapperClassName="w-14 h-14"
                    className="w-14 h-14 object-cover rounded-sm"
                    watermark={false}
                  />
                ))}
                {Array.isArray(o.photos) && o.photos.length > 8 && (
                  <div className="w-14 h-14 rounded-sm bg-white/5 flex items-center justify-center text-white/50 text-xs">
                    +{o.photos.length - 8}
                  </div>
                )}
              </div>

              {/* Download link block — visible once validated, regardless of email_sent status.
                  Lets the admin copy/share the secure link manually if SendGrid failed. */}
              {isCompleted && o.download_url && (
                <DownloadLinkBand
                  order={o}
                  downloadUrl={o.download_url}
                  emailSent={o.email_sent}
                  emailError={o.email_error}
                  expiresAt={o.download_expires_at}
                />
              )}
            </div>
          );
        })}
      </div>
    )}
  </div>
);
