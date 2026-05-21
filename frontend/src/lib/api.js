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

export const fetchPhotos = async () => {
  const { data } = await api.get("/photos");
  return data;
};

export const fetchConfig = async () => {
  const { data } = await api.get("/config");
  return data;
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

// Orders
export const createOrder = async (payload) => {
  const { data } = await api.post("/orders", payload);
  return data;
};

export const fetchOrder = async (orderId) => {
  const { data } = await api.get(`/orders/${orderId}`);
  return data;
};

export const fetchAdminOrders = async (token) => {
  const { data } = await api.get("/admin/orders", {
    headers: { "X-Admin-Token": token },
  });
  return data;
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
