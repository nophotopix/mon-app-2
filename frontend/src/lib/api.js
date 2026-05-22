import axios from "axios";

const BACKEND_URL =
process.env.REACT_APP_BACKEND_URL ||
"https://image-select-pay.preview.emergentagent.com";

export const API = `${BACKEND_URL}/api`;
export const ASSET_BASE = BACKEND_URL;

export const api = axios.create({ baseURL: API });

export const resolveImageUrl = (url) => {
if (!url) return "";
if (url.startsWith("http")) return url;
return `${ASSET_BASE}${url}`;
};

export const fetchPhotos = async () => {
const { data } = await api.get("/photos");
return data;
};

export const uploadPhoto = async (file) => {
const formData = new FormData();
formData.append("file", file);

const { data } = await api.post("/photos/upload", formData, {
headers: { "Content-Type": "multipart/form-data" },
});

return data;
};

export const deletePhoto = async (id, token) => {
const { data } = await api.delete(`/admin/photos/${id}`, {
headers: { "x-admin-token": token },
});
return data;
};

export const createOrder = async (payload) => {
const { data } = await api.post("/orders", payload);
return data;
};

export const fetchAdminOrders = async (token) => {
const { data } = await api.get("/admin/orders", {
headers: { "x-admin-token": token },
});
return data;
};

export const validateOrder = async (id, token) => {
const { data } = await api.post(
`/admin/orders/${id}/validate`,
{},
{ headers: { "x-admin-token": token } }
);
return data;
};

export const deleteOrder = async (id, token) => {
const { data } = await api.delete(`/admin/orders/${id}`, {
headers: { "x-admin-token": token },
});
return data;
};

export const adminLogin = async (password) => {
const { data } = await api.post("/admin/login", { password });
return data;
};

export const fetchConfig = async () => {
try {
const { data } = await api.get("/config");
return data;
} catch (error) {
return {};
}
};

export const fetchOrder = async (orderId) => {
const { data } = await api.get(`/orders/${orderId}`);
return data;
};
