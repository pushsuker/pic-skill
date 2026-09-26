import { defineStore } from "pinia";
import { ref } from "vue";
import api from "./api";
export const useAuth = defineStore("auth", () => {
  const user = ref(null);
  function setSession(data) {
    localStorage.setItem("bpes_training_token", data.token);
    user.value = data.user;
  }
  async function login(body) {
    setSession((await api.post("/auth/login", body)).data);
  }
  async function changePassword(body) {
    setSession((await api.post("/auth/change-password", body)).data);
  }
  async function fetchMe() {
    if (localStorage.getItem("bpes_training_token")) {
      try {
        user.value = (await api.get("/auth/me")).data;
      } catch {
        logout();
      }
    }
  }
  function logout() {
    localStorage.removeItem("bpes_training_token");
    user.value = null;
  }
  return { user, login, changePassword, fetchMe, logout };
});
