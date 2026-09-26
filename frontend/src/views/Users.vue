<template>
  <section>
    <div class="toolbar">
      <h1 class="page-title">จัดการผู้ใช้</h1>
      <v-btn color="primary" @click="open()">เพิ่มผู้ใช้</v-btn>
    </div>
    <TaskStatus :busy="busy" :error="error" :message="message" /><v-card
      ><v-table
        ><thead>
          <tr>
            <th>ชื่อผู้ใช้</th>
            <th>ชื่อ-นามสกุล</th>
            <th>บทบาท</th>
            <th>สถานะ</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.username }}</td>
            <td>{{ u.full_name }}</td>
            <td>{{ u.role }}</td>
            <td>{{ u.is_active ? "ใช้งาน" : "ปิดบัญชี" }}</td>
            <td>
              <v-btn
                v-if="u.role !== 'admin'"
                size="small"
                variant="text"
                @click="open(u)"
                >แก้ไข</v-btn
              >
            </td>
          </tr>
        </tbody></v-table
      ></v-card
    >
    <v-dialog v-model="show" max-width="560" :persistent="busy"
      ><v-card class="pa-6"
        ><h2 class="text-h6 mb-4">
          {{ form.id ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้" }}
        </h2>
        <TaskStatus :error="error" />
        <form @submit.prevent="save">
          <v-text-field
            v-model="form.username"
            label="ชื่อผู้ใช้"
            :disabled="!!form.id"
            required
            maxlength="50"
          /><v-text-field
            v-model="form.full_name"
            label="ชื่อ-นามสกุล"
            required
            maxlength="100"
          /><v-text-field
            v-model="form.password"
            :label="form.id ? 'รหัสผ่านเริ่มต้นใหม่ (เว้นว่างได้)' : 'รหัสผ่านเริ่มต้นที่ผู้ดูแลกำหนด'"
            type="password"
            :required="!form.id"
            minlength="8"
            autocomplete="off"
            hint="ผู้ใช้จะตั้งรหัสผ่านของตนเองหลังเข้าสู่ระบบครั้งแรก ไม่มีการสุ่มรหัสผ่าน"
            persistent-hint
          /><v-select
            v-model="form.role"
            label="บทบาท"
            :items="['evaluatee', 'evaluator']"
            :disabled="!!form.id"
          /><v-text-field
            v-model="form.department"
            label="แผนก"
            maxlength="100"
          /><v-text-field
            v-model="form.position"
            label="ตำแหน่ง"
            maxlength="100"
          /><v-checkbox
            v-if="form.id"
            v-model="form.is_active"
            label="เปิดใช้งานบัญชี"
          />
          <div class="actions justify-end">
            <v-btn variant="text" :disabled="busy" @click="show = false"
              >ยกเลิก</v-btn
            ><v-btn type="submit" color="primary" :loading="busy"
              >บันทึกผู้ใช้</v-btn
            >
          </div>
        </form></v-card
      ></v-dialog
    >
  </section>
</template>
<script setup>
import { ref, onMounted } from "vue";
import api, { useTask } from "../api";
import TaskStatus from "../components/TaskStatus.vue";
const users = ref([]),
  show = ref(false),
  form = ref({}),
  { busy, error, message, run } = useTask();
async function load() {
  users.value = (await api.get("/users")).data;
}
onMounted(() => run(load));
function open(u) {
  form.value = u
    ? { ...u, password: "", is_active: !!u.is_active }
    : {
        username: "",
        full_name: "",
        password: "",
        department: "",
        position: "",
        role: "evaluatee",
        is_active: true,
      };
  error.value = "";
  show.value = true;
}
function save() {
  run(async () => {
    if (form.value.id) await api.put(`/users/${form.value.id}`, form.value);
    else await api.post("/users", form.value);
    show.value = false;
    await load();
  }, "บันทึกผู้ใช้แล้ว");
}
</script>
