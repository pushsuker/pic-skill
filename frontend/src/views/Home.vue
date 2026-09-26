<template>
  <section>
    <div class="toolbar">
      <h1 class="page-title">
        {{
          auth.user.role === "evaluator" ? "งานที่ได้รับมอบหมาย" : "รอบประเมิน"
        }}
      </h1>
      <v-btn
        v-if="auth.user.role === 'admin'"
        color="primary"
        prepend-icon="mdi-plus"
        @click="show = true"
        >สร้างรอบประเมิน</v-btn
      >
    </div>
    <TaskStatus :busy="busy" :error="error" />
    <v-alert v-if="!busy && !items.length" type="info" variant="tonal"
      >ยังไม่มีรอบหรืองานที่ได้รับมอบหมาย</v-alert
    >
    <v-row
      ><v-col v-for="p in items" :key="p.id" cols="12" md="6" xl="4"
        ><v-card class="pa-5" height="100%"
          ><h2 class="text-h6">{{ p.name || p.full_name }}</h2>
          <p class="muted my-2">{{ p.period_name || "ปี " + p.eval_year }}</p>
          <v-chip class="mb-4" size="small">{{ p.status }}</v-chip>
          <p v-if="p.starts_at" class="mb-4">
            {{ periodDate(p.starts_at) }} – {{ periodDate(p.ends_at) }}
          </p>
          <div class="actions">
            <v-btn
              :to="
                auth.user.role === 'admin'
                  ? `/admin/period/${p.id}`
                  : auth.user.role === 'evaluatee'
                    ? `/self/${p.id}`
                    : `/evaluate/${p.id}`
              "
              color="primary"
              >{{
                auth.user.role === "admin"
                  ? "จัดการรอบ"
                  : auth.user.role === "evaluatee"
                    ? "ประเมินตนเอง"
                    : "เริ่มประเมิน"
              }}</v-btn
            ><v-btn
              v-if="auth.user.role === 'admin'"
              :to="`/report/${p.id}`"
              variant="outlined"
              >ติดตาม / รายงาน</v-btn
            >
          </div></v-card
        ></v-col
      ></v-row
    >
    <v-dialog v-model="show" max-width="560" :persistent="busy"
      ><v-card class="pa-6"
        ><h2 class="text-h6 mb-4">สร้างรอบประเมิน</h2>
        <TaskStatus :error="error" />
        <form @submit.prevent="create">
          <v-text-field
            v-model="form.name"
            label="ชื่อรอบ"
            required
            maxlength="200"
          /><v-text-field
            v-model.number="form.eval_year"
            type="number"
            min="2000"
            max="2100"
            label="ปี ค.ศ."
            required
          /><v-text-field
            v-model="form.starts_at"
            type="date"
            label="วันเริ่มประเมิน"
            required
          /><v-text-field
            v-model="form.ends_at"
            :min="form.starts_at"
            hint="ประเมินได้จนสิ้นสุดวันนี้ตามเวลาไทย"
            persistent-hint
            type="date"
            label="วันสิ้นสุดประเมิน"
            required
          />
          <div class="actions justify-end">
            <v-btn variant="text" :disabled="busy" @click="show = false"
              >ยกเลิก</v-btn
            ><v-btn type="submit" color="primary" :loading="busy"
              >สร้างรอบ</v-btn
            >
          </div>
        </form></v-card
      ></v-dialog
    >
  </section>
</template>
<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../auth";
import api, { useTask, periodDate } from "../api";
import TaskStatus from "../components/TaskStatus.vue";
const auth = useAuth(),
  router = useRouter(),
  items = ref([]),
  show = ref(false),
  form = ref({
    name: "",
    eval_year: new Date().getFullYear(),
    starts_at: "",
    ends_at: "",
  }),
  { busy, error, run } = useTask();
onMounted(() =>
  run(async () => {
    items.value = (
      await api.get(
        auth.user.role === "evaluator" ? "/assignments/me" : "/periods",
      )
    ).data;
  }),
);
function create() {
  run(async () => {
    const r = await api.post("/periods", {
      ...form.value,
      starts_at: form.value.starts_at,
      ends_at: form.value.ends_at,
    });
    show.value = false;
    await router.push(`/admin/period/${r.data.id}`);
  });
}
</script>
