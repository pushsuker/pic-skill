import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import { createApp } from "vue";
import { createPinia } from "pinia";
import { createVuetify } from "vuetify";
import { th } from "vuetify/locale";
import App from "./App.vue";
import router from "./router";
const app = createApp(App);
app.use(
  createVuetify({
    locale: { locale: "th", messages: { th } },
    theme: {
      defaultTheme: "bpes",
      themes: {
        bpes: {
          dark: false,
          colors: {
            primary: "#1a3a8f",
            secondary: "#176451",
            background: "#f4f7fb",
            surface: "#fff",
          },
        },
      },
    },
    defaults: {
      VTextField: { variant: "outlined", density: "comfortable" },
      VSelect: { variant: "outlined", density: "comfortable" },
      VTextarea: { variant: "outlined" },
      VBtn: { style: "text-transform:none;letter-spacing:normal" },
      VCard: { rounded: "lg" },
    },
  }),
);
app.use(createPinia()).use(router).mount("#app");
