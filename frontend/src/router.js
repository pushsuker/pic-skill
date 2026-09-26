import { createRouter, createWebHistory } from "vue-router";
import { useAuth } from "./auth";
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      component: () => import("./views/Login.vue"),
      meta: { guest: true },
    },
    { path: "/password", component: () => import("./views/Password.vue") },
    { path: "/", component: () => import("./views/Home.vue") },
    { path: "/profile", component: () => import("./views/Profile.vue") },
    {
      path: "/admin/users",
      component: () => import("./views/Users.vue"),
      meta: { role: "admin" },
    },
    {
      path: "/admin/period/:id",
      component: () => import("./views/Period.vue"),
      meta: { role: "admin" },
    },
    {
      path: "/self/:id",
      component: () => import("./views/Self.vue"),
      meta: { role: "evaluatee" },
    },
    {
      path: "/evaluate/:id",
      component: () => import("./views/Evaluate.vue"),
      meta: { role: "evaluator" },
    },
    {
      path: "/report/:id",
      component: () => import("./views/Report.vue"),
      meta: { role: "admin" },
    },
    { path: "/result/:id", component: () => import("./views/Result.vue") },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
router.beforeEach(async (to) => {
  const auth = useAuth();
  if (!auth.user) await auth.fetchMe();
  if (!auth.user) return to.meta.guest ? true : "/login";
  if (auth.user.must_change_password)
    return to.path === "/password" ? true : "/password";
  if (to.meta.guest || to.path === "/password") return "/";
  if (to.meta.role && auth.user.role !== to.meta.role) return "/";
  return true;
});
export default router;
