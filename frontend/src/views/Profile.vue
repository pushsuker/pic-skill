<template>
  <section style="max-width: 600px">
    <h1 class="page-title mb-6">ข้อมูลส่วนตัว / รหัสผ่าน</h1>
    <TaskStatus :busy="busy" :error="error" :message="message" /><v-card
      class="pa-5 mb-5"
      ><form @submit.prevent="save">
        <v-text-field
          :model-value="auth.user.username"
          label="ชื่อผู้ใช้"
          readonly
        /><v-text-field
          v-model="form.full_name"
          label="ชื่อ-นามสกุล"
          maxlength="100"
          required
        /><v-text-field
          v-model="form.department"
          label="แผนก"
          maxlength="100"
        /><v-text-field
          v-model="form.position"
          label="ตำแหน่ง"
          maxlength="100"
        /><v-btn type="submit" color="primary" :loading="busy"
          >บันทึกข้อมูลส่วนตัว</v-btn
        >
      </form></v-card
    ><v-card class="pa-5"
      ><form @submit.prevent="change">
        <v-text-field
          v-model="pw.old_password"
          label="รหัสผ่านเดิม"
          type="password"
          autocomplete="current-password"
          required
        /><v-text-field
          v-model="pw.new_password"
          label="รหัสผ่านใหม่"
          type="password"
          autocomplete="new-password"
          required
          minlength="8"
        /><v-btn type="submit" color="primary" :loading="busy"
          >เปลี่ยนรหัสผ่าน</v-btn
        >
      </form></v-card
    >
  </section>
</template>
<script setup>
import { ref } from "vue";
import { useAuth } from "../auth";
import api, { useTask } from "../api";
import TaskStatus from "../components/TaskStatus.vue";
const auth = useAuth(),
  form = ref({
    full_name: auth.user.full_name,
    department: auth.user.department,
    position: auth.user.position,
  }),
  pw = ref({ old_password: "", new_password: "" }),
  { busy, error, message, run } = useTask();
function save() {
  run(async () => {
    auth.user = (await api.put("/profile", form.value)).data;
  }, "บันทึกข้อมูลแล้ว");
}
function change() {
  run(async () => {
    await auth.changePassword(pw.value);
    pw.value = { old_password: "", new_password: "" };
  }, "เปลี่ยนรหัสผ่านแล้ว");
}
</script>
