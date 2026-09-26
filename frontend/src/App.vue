<template>
  <v-app>
    <template v-if="auth.user && !auth.user.must_change_password">
      <v-app-bar color="primary" class="no-print"
        ><v-app-bar-nav-icon
          aria-label="เปิดเมนู"
          @click="drawer = !drawer" /><v-app-bar-title
          >PIC • ประเมินบุคลากร</v-app-bar-title
        ><v-btn icon="mdi-logout" aria-label="ออกจากระบบ" @click="logout"
      /></v-app-bar>
      <v-navigation-drawer v-model="drawer" class="no-print"
        ><v-list-item
          :title="auth.user.full_name"
          :subtitle="roleNames[auth.user.role]"
          class="py-4" /><v-divider /><v-list nav
          ><v-list-item
            to="/"
            title="รอบประเมิน / งานของฉัน"
            prepend-icon="mdi-view-dashboard"
            exact /><v-list-item
            v-if="auth.user.role === 'admin'"
            to="/admin/users"
            title="จัดการผู้ใช้"
            prepend-icon="mdi-account-group" /><v-list-item
            to="/profile"
            title="ข้อมูลส่วนตัว / รหัสผ่าน"
            prepend-icon="mdi-account" /></v-list
      ></v-navigation-drawer>
    </template>
    <v-main
      ><v-container fluid class="pa-4 pa-md-6"
        ><RouterView :key="$route.fullPath" /></v-container
    ></v-main>
  </v-app>
</template>
<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "./auth";
const auth = useAuth(),
  router = useRouter(),
  drawer = ref(null);
const roleNames = {
  admin: "ฝ่ายบุคลากร",
  evaluatee: "ผู้รับการประเมิน",
  evaluator: "กรรมการ",
};
function logout() {
  auth.logout();
  router.push("/login");
}
</script>
<style>
body,
.v-application,
.v-field,
.v-btn {
  font-family: system-ui, "Noto Sans Thai", sans-serif;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.page-title {
  font-size: clamp(1.25rem, 3vw, 1.7rem);
  color: #1a3a8f;
}
.v-main,
.v-container {
  min-width: 0;
}
.v-table thead {
  background: #edf2fc;
}
.v-table th {
  white-space: nowrap;
}
.v-table td {
  overflow-wrap: anywhere;
}
.muted {
  color: #58687d;
}
.score-select {
  max-width: 360px;
}
.signature {
  max-width: 220px;
  height: 90px;
  object-fit: contain;
}
.auth-card {
  max-width: 500px;
  margin: 5vh auto;
}
.v-btn {
  max-width: 100%;
}
.v-alert {
  overflow-wrap: anywhere;
}
@media print {
  @page {
    size: A4;
    margin: 15mm;
  }
  .no-print,
  .v-progress-linear {
    display: none !important;
  }
  .v-main,
  .v-container {
    padding: 0 !important;
  }
  .v-application {
    background: white !important;
  }
  .v-card {
    box-shadow: none !important;
    overflow: visible !important;
  }
  .v-table,
  .v-table__wrapper {
    display: block !important;
    overflow: visible !important;
    height: auto !important;
  }
  .v-table table {
    table-layout: fixed;
    width: 100%;
  }
  .v-table th,
  .v-table td {
    white-space: normal !important;
    overflow-wrap: anywhere !important;
    font-size: 10pt;
    padding: 6px !important;
    height: auto !important;
  }
  .v-table thead {
    display: table-header-group;
  }
  .v-table .v-btn {
    height: auto !important;
    min-width: 0 !important;
  }
  .v-table .v-btn__content {
    display: block !important;
    white-space: normal !important;
    overflow: visible !important;
    text-align: left;
  }
  tr,
  .signature-block,
  .committee-result {
    break-inside: avoid;
  }
  .print-summary {
    display: block !important;
  }
  .print-title {
    color: black !important;
  }
  a {
    overflow-wrap: anywhere;
  }
}
</style>
