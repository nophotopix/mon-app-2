import axios from "axios";

const BACKEND_URL = "http://localhost:8000";

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

export const createOrder = async (payload) => {
const { data } = await api.post("/orders", payload);
return data;
};
export const fetchAdminOrders = async () => {
const { data } = await api.get("/admin/orders");
return data;
};
export const adminLogin = async (password) => {
const { data } = await api.post("/admin/login", { password });
return data;
};
