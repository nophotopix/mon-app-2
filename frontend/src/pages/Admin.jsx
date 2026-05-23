import { useEffect, useRef, useState } from "react";
import { Header } from "../components/Header";
import {
  adminLogin,
  deletePhoto,
  deleteOrder,
  fetchAdminOrders,
  fetchPhotos,
  resolveImageUrl,
  uploadPhoto,
  validateOrder,
} from "../lib/api";
import { PaymentMethodIcon } from "../components/PaymentIcons";
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
} from "@phosphor-icons/react";

const TOKEN_KEY = "nophotopix_admin_token";

export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState("photos"); // photos | orders
  const [photos, setPhotos] = useState([]);
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

  useEffect(() => {
    if (token) {
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
        await uploadPhoto(file, token);
      }
      toast.success(`${files.length} photo${files.length > 1 ? "s" : ""} ajoutée${files.length > 1 ? "s" : ""}`);
      await loadPhotos();
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
    } catch {
      toast.error("Erreur de suppression");
    }
  };

  const handleValidate = async (orderId) => {
    if (!confirm("Valider cette commande et envoyer l'email au client ?")) return;
    setValidatingId(orderId);
    try {
      await validateOrder(orderId, token);
      toast.success("Commande validée · email envoyé");
      await loadOrders();
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 401) {
        toast.error("Session expirée");
        handleLogout();
      } else if (status === 502 && detail) {
        // Order was validated but email failed — show specific error
        toast.error(detail, { duration: 12000 });
        await loadOrders();
      } else {
        toast.error("Erreur de validation");
      }
    } finally {
      setValidatingId(null);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!confirm("Supprimer cette commande définitivement ?")) return;
    try {
      await deleteOrder(orderId, token);
      toast.success("Commande supprimée");
      await loadOrders();
    } catch {
      toast.error("Erreur de suppression");
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
            data-testid="tab-photos"
            onClick={() => setTab("photos")}
            className={`flex items-center gap-2 px-5 py-3 text-sm transition-colors border-b-2 -mb-px ${
              tab === "photos"
                ? "border-[#E8B23A] text-white"
                : "border-transparent text-white/50 hover:text-white"
            }`}
          >
            <ImageIcon size={16} /> Photos ({photos.length})
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
            validatingId={validatingId}
            onValidate={handleValidate}
            onDelete={handleDeleteOrder}
            onRefresh={loadOrders}
          />
        )}
      </div>
    </div>
  );
}

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
              <img
                src={resolveImageUrl(p.url)}
                alt={p.title || ""}
                className="w-full h-full object-cover"
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

const OrdersTab = ({ orders, validatingId, onValidate, onDelete, onRefresh }) => (
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
          const pending = o.status === "pending";
          return (
            <div
              key={o.id}
              data-testid={`admin-order-${o.id}`}
              className={`border rounded-sm p-6 transition-colors ${
                pending
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
                    {pending ? (
                      <span className="inline-flex items-center gap-1 text-amber-400 text-xs">
                        <Clock size={12} /> En attente
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                        <CheckCircle size={12} weight="fill" />
                        Validée {o.email_sent && "· email envoyé"}
                      </span>
                    )}
                  </div>
                  <p className="text-white/80 text-sm flex items-center gap-2">
                    <EnvelopeSimple size={14} className="text-white/40" />
                    {o.email}
                  </p>
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
                  {pending && (
                    <button
                      data-testid={`validate-order-${o.id}`}
                      disabled={validatingId === o.id}
                      onClick={() => onValidate(o.id)}
                      className="bg-gradient-to-r from-[#E8B23A] via-[#FFD66B] to-[#C8902A] text-black px-4 py-2.5 rounded-sm font-medium text-sm hover:brightness-110 transition disabled:opacity-50 flex items-center gap-2 justify-center"
                    >
                      <PaperPlaneTilt size={14} weight="bold" />
                      {validatingId === o.id ? "Envoi..." : "Valider & envoyer"}
                    </button>
                  )}
                  <button
                    data-testid={`delete-order-${o.id}`}
                    onClick={() => onDelete(o.id)}
                    className="text-white/40 hover:text-red-400 px-3 py-2 text-sm transition-colors flex items-center gap-1 justify-center"
                    title="Supprimer la commande"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>

              {/* Thumbnails */}
              <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-2">
                {(Array.isArray(o.photos) ? o.photos : []).slice(0, 8).map((p) => (
                  <img
                    key={p.id}
                    src={resolveImageUrl(p.url)}
                    alt={p.title || ""}
                    className="w-14 h-14 object-cover rounded-sm"
                  />
                ))}
                {Array.isArray(o.photos) && o.photos.length > 8 && (
                  <div className="w-14 h-14 rounded-sm bg-white/5 flex items-center justify-center text-white/50 text-xs">
                    +{o.photos.length - 8}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);
