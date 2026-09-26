<template>
  <v-card class="auth-card pa-6"
    ><h1 class="page-title mb-4">ตั้งรหัสผ่านของคุณ</h1>
    <p class="mb-4">เข้าสู่ระบบครั้งแรกแล้ว กรุณากำหนดรหัสผ่านด้วยตนเองและยืนยันอีกครั้ง</p>
    <TaskStatus :busy="busy" :error="error" />
    <form autocomplete="off" @submit.prevent="submit">
      <v-text-field
        v-model="form.new_password"
        label="รหัสผ่านใหม่ที่คุณกำหนดเอง"
        type="password"
        autocomplete="off"
        required
        minlength="8"
        hint="อย่างน้อย 8 ตัวอักษร ไม่เกิน 72 ไบต์"
        persistent-hint
      /><v-text-field
        v-model="confirm"
        label="ยืนยันรหัสผ่านใหม่"
        type="password"
        autocomplete="off"
        required
      /><v-btn type="submit" color="primary" block :loading="busy"
        >บันทึกรหัสผ่าน</v-btn
      ><v-btn
        block
        variant="text"
        class="mt-3"
        :disabled="busy"
        @click="
          auth.logout();
          router.push('/login');
        "
        >ออกจากระบบ</v-btn
      >
    </form></v-card
  >
</template>
<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../auth";
import { useTask } from "../api";
import TaskStatus from "../components/TaskStatus.vue";
const auth = useAuth(),
  router = useRouter(),
  form = ref({ new_password: "" }),
  confirm = ref(""),
  { busy, error, run } = useTask();
function submit() {
  run(async () => {
    if (form.value.new_password !== confirm.value)
      throw new Error("ยืนยันรหัสผ่านไม่ตรงกัน");
    await auth.changePassword(form.value);
    await router.push("/");
  });
}
</script>
