import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;
export const ASSET_BASE = BACKEND_URL;

export const resolveImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${ASSET_BASE}${url}`;
};

export const api = axios.create({ baseURL: API });

// Always return an array — never undefined / object / null.
const asArray = (data) => (Array.isArray(data) ? data : []);

export const fetchPhotos = async () => {
  try {
    const { data } = await api.get("/photos");
    return asArray(data);
  } catch (e) {
    console.error("fetchPhotos failed:", e);
    return [];
  }
};

export const fetchConfig = async () => {
  try {
    const { data } = await api.get("/config");
    return data && typeof data === "object" ? data : {};
  } catch (e) {
    console.error("fetchConfig failed:", e);
    return {
      price_per_photo: 3,
      paypal_handle: "nophotopix",
      revolut_handle: "nophotopix",
      wero_phone: "+33760599312",
      wero_phone_display: "07 60 59 93 12",
      currency: "EUR",
    };
  }
};

export const adminLogin = async (password) => {
  const { data } = await api.post("/admin/login", { password });
  return data;
};

export const uploadPhoto = async (file, token, title) => {
  const formData = new FormData();
  formData.append("file", file);
  if (title) formData.append("title", title);
  const { data } = await api.post("/photos", formData, {
    headers: { "X-Admin-Token": token, "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const deletePhoto = async (id, token) => {
  const { data } = await api.delete(`/photos/${id}`, {
    headers: { "X-Admin-Token": token },
  });
  return data;
};

// Albums
export const fetchAlbums = async () => {
  try {
    const { data } = await api.get("/albums");
    return asArray(data);
  } catch (e) {
    console.error("fetchAlbums failed:", e);
    return [];
  }
};

export const fetchAlbum = async (albumId) => {
  const { data } = await api.get(`/albums/${albumId}`);
  return data;
};

export const createAlbum = async (payload, token) => {
  const { data } = await api.post("/admin/albums", payload, {
    headers: { "X-Admin-Token": token },
  });
  return data;
};

export const updateAlbum = async (albumId, payload, token) => {
  const { data } = await api.put(`/admin/albums/${albumId}`, payload, {
    headers: { "X-Admin-Token": token },
  });
  return data;
};

export const deleteAlbum = async (albumId, token, deletePhotos = false) => {
  const { data } = await api.delete(
    `/admin/albums/${albumId}?delete_photos=${deletePhotos ? "true" : "false"}`,
    { headers: { "X-Admin-Token": token } }
  );
  return data;
};

export const uploadPhotoToAlbum = async (file, token, albumId, title) => {
  const formData = new FormData();
  formData.append("file", file);
  if (title) formData.append("title", title);
  if (albumId) formData.append("album_id", albumId);
  const { data } = await api.post("/photos", formData, {
    headers: { "X-Admin-Token": token, "Content-Type": "multipart/form-data" },
  });
  return data;
};

// Orders
export const createOrder = async (payload) => {
  const { data } = await api.post("/orders", payload);
  return data;
};

// Stripe
export const createStripeCheckout = async ({ email, photo_ids, album_id }) => {
  const { data } = await api.post("/payments/checkout/session", {
    email,
    photo_ids,
    album_id: album_id || null,
    origin_url: window.location.origin,
  });
  return data;
};

export const fetchStripeStatus = async (sessionId) => {
  const { data } = await api.get(`/payments/checkout/status/${sessionId}`);
  return data;
};

// Download
export const fetchDownload = async (token) => {
  const { data } = await api.get(`/download/${token}`);
  return data;
};

export const downloadFileUrl = (token, photoId) =>
  `${API}/download/${token}/file/${photoId}`;

export const fetchOrder = async (orderId) => {
  const { data } = await api.get(`/orders/${orderId}`);
  return data;
};

export const fetchAdminOrders = async (token) => {
  try {
    const { data } = await api.get("/admin/orders", {
      headers: { "X-Admin-Token": token },
    });
    return asArray(data);
  } catch (e) {
    console.error("fetchAdminOrders failed:", e);
    throw e; // propagate so caller can detect 401 and logout
  }
};

export const validateOrder = async (orderId, token) => {
  const { data } = await api.post(
    `/admin/orders/${orderId}/validate`,
    {},
    { headers: { "X-Admin-Token": token } }
  );
  return data;
};

export const deleteOrder = async (orderId, token) => {
  const { data } = await api.delete(`/admin/orders/${orderId}`, {
    headers: { "X-Admin-Token": token },
  });
  return data;
};
