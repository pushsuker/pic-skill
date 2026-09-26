import axios from "axios";
import { ref } from "vue";
const api = axios.create({ baseURL: "/api", timeout: 15000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("bpes_training_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    // File requests return Blob bodies even when the server sends a JSON error.
    let body = err.response?.data;
    if (body instanceof Blob) {
      try {
        body = JSON.parse(await body.text());
      } catch {
        body = null;
      }
    }
    if (err.response?.status === 401 && err.config.url !== "/auth/login") {
      localStorage.removeItem("bpes_training_token");
      window.location.assign("/login");
    }
    if (body?.code === "PASSWORD_CHANGE_REQUIRED")
      window.location.assign("/password");
    return Promise.reject(
      new Error(
        body?.message || (err.response
          ? `คำขอไม่สำเร็จ (HTTP ${err.response.status}) กรุณาลองใหม่`
          : "เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่"),
      ),
    );
  },
);
export function useTask() {
  const busy = ref(false),
    error = ref(""),
    message = ref("");
  async function run(fn, success = "") {
    if (busy.value) return;
    busy.value = true;
    error.value = "";
    message.value = "";
    try {
      await fn();
      message.value = success;
    } catch (e) {
      error.value = e.message;
    } finally {
      busy.value = false;
    }
  }
  return { busy, error, message, run };
}
export const number = (p) =>
  p === null || p === undefined ? "—" : Number(p).toFixed(2);
export const date = (value) =>
  value ? new Date(value).toLocaleString("th-TH") : "—";
export const periodDay = (value = new Date()) =>
  new Date(value).toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
export const periodDate = (value) => value
  ? new Date(value).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" }) : "—";
export const isOpen = (p) =>
  p?.status === "open" &&
  periodDay() >= periodDay(p.starts_at) &&
  periodDay() <= periodDay(p.ends_at);
export async function fileUrl(id) {
  return URL.createObjectURL(
    await api.get(`/files/${id}`, { responseType: "blob" }),
  );
}
export default api;
