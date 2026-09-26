import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify, { transformAssetUrls } from "vite-plugin-vuetify";
export default defineConfig({
  plugins: [
    vue({ template: { transformAssetUrls } }),
    vuetify({ autoImport: true }),
  ],
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:3101", changeOrigin: true } },
  },
  build: { outDir: "../dist", emptyOutDir: true },
});
