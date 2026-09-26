<template>
  <v-card class="auth-card pa-6"
    ><h1 class="page-title mb-4">
      {{ register ? "ลงทะเบียนผู้รับการประเมิน" : "เข้าสู่ระบบ PIC" }}
    </h1>
    <TaskStatus :busy="busy" :error="error" :message="message" />
    <form @submit.prevent="submit">
      <v-text-field
        v-model="form.username"
        label="ชื่อผู้ใช้"
        autocomplete="username"
        required
        maxlength="50"
        :disabled="busy"
      />
      <v-text-field
        v-model="form.password"
        label="รหัสผ่าน"
        type="password"
        :autocomplete="register ? 'new-password' : 'current-password'"
        required
        :minlength="register ? 8 : undefined"
        :disabled="busy"
      />
      <template v-if="register"
        ><v-text-field
          v-model="form.full_name"
          label="ชื่อ-นามสกุล"
          required
          maxlength="100" /><v-text-field
          v-model="form.department"
          label="แผนก"
          maxlength="100" /><v-text-field
          v-model="form.position"
          label="ตำแหน่ง"
          maxlength="100"
      /></template>
      <v-btn block color="primary" type="submit" :loading="busy">{{
        register ? "ลงทะเบียน" : "เข้าสู่ระบบ"
      }}</v-btn
      ><v-btn
        block
        variant="text"
        class="mt-3"
        :disabled="busy"
        @click="
          register = !register;
          error = '';
          message = '';
        "
        >{{
          register
            ? "มีบัญชีแล้ว เข้าสู่ระบบ"
            : "สมัครใช้งานสำหรับผู้รับการประเมิน"
        }}</v-btn
      >
    </form></v-card
  >
</template>
<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../auth";
import api, { useTask } from "../api";
import TaskStatus from "../components/TaskStatus.vue";
const auth = useAuth(),
  router = useRouter(),
  register = ref(false),
  form = ref({
    username: "",
    password: "",
    full_name: "",
    department: "",
    position: "",
  }),
  { busy, error, message, run } = useTask();
function submit() {
  run(async () => {
    if (register.value) {
      await api.post("/auth/register", form.value);
      register.value = false;
      form.value.password = "";
      message.value = "สมัครสำเร็จ กรุณาเข้าสู่ระบบ";
    } else {
      await auth.login(form.value);
      await router.push("/");
    }
  });
}
</script>
