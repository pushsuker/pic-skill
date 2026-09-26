<template>
  <section>
    <div class="toolbar">
      <h1 class="page-title">จัดการรอบ: {{ data?.period.name }}</h1>
      <v-btn to="/" variant="text">กลับรอบทั้งหมด</v-btn>
    </div>
    <TaskStatus :busy="busy" :error="error" :message="message" />
    <template v-if="data"
      ><v-card class="pa-5 mb-5"
        ><div class="actions mb-3">
          <v-chip>{{ data.period.status }}</v-chip
          ><span
            >{{ periodDate(data.period.starts_at) }} –
            {{ periodDate(data.period.ends_at) }}</span
          >
        </div>
        <div class="actions">
          <v-btn
            v-if="draft"
            color="primary"
            :disabled="busy"
            @click="action('open')"
            >เปิดรอบ</v-btn
          ><v-btn
            v-if="data.period.status === 'open'"
            color="warning"
            :disabled="busy"
            @click="action('close')"
            >ปิดรอบ</v-btn
          ><v-btn
            v-if="!draft && !data.period.published_at"
            color="secondary"
            :disabled="busy"
            @click="action('publish')"
            >เผยแพร่ผลเมื่อครบ</v-btn
          ><v-chip v-if="data.period.published_at" color="success"
            >เผยแพร่แล้ว</v-chip
          ><v-btn :to="`/report/${id}`" variant="outlined"
            >ติดตาม / รายงาน</v-btn
          >
        </div>
        <p class="muted mt-3">
          แก้ชุดหัวข้อและการมอบหมายได้เฉพาะฉบับร่าง
          หลังเปิดแล้วชุดประเมินจะถูกตรึง
        </p></v-card
      >
      <v-expansion-panels v-if="draft" class="mb-5"
        ><v-expansion-panel title="แก้ชื่อและช่วงวันที่ประเมิน"
          ><v-expansion-panel-text
            ><form @submit.prevent="savePeriod">
              <v-text-field
                v-model="periodForm.name"
                label="ชื่อรอบ"
                required
              /><v-text-field
                v-model.number="periodForm.eval_year"
                label="ปี ค.ศ."
                type="number"
                required
              /><v-text-field
                v-model="periodForm.starts_at"
                label="วันเริ่มประเมิน"
                type="date"
                required
              /><v-text-field
                v-model="periodForm.ends_at"
                :min="periodForm.starts_at"
                hint="ประเมินได้จนสิ้นสุดวันนี้ตามเวลาไทย"
                persistent-hint
                label="วันสิ้นสุดประเมิน"
                type="date"
                required
              /><v-btn type="submit" color="primary" :loading="busy"
                >บันทึกรอบ</v-btn
              >
            </form></v-expansion-panel-text
          ></v-expansion-panel
        ></v-expansion-panels
      >
      <v-card class="pa-5 mb-5"
        ><h2 class="text-h6 mb-4">1. หัวข้อและตัวชี้วัด</h2>
        <form v-if="draft" @submit.prevent="addTopic" class="mb-4">
          <v-text-field
            v-model="topicName"
            label="ชื่อหัวข้อใหม่"
            required
            maxlength="200"
          /><v-btn type="submit" color="primary" :loading="busy"
            >เพิ่มหัวข้อ</v-btn
          >
        </form>
        <v-expansion-panels multiple
          ><v-expansion-panel
            v-for="t in data.topics"
            :key="t.id"
            :title="t.name"
            ><v-expansion-panel-text
              ><div v-if="draft" class="actions mb-4">
                <v-btn size="small" color="primary" @click="openIndicator(t.id)"
                  >เพิ่มตัวชี้วัด</v-btn
                ><v-btn size="small" variant="text" @click="editTopic(t)"
                  >แก้ชื่อหัวข้อ</v-btn
                ><v-btn
                  size="small"
                  color="error"
                  variant="text"
                  @click="remove('topics', t.id)"
                  >ลบหัวข้อว่าง</v-btn
                >
              </div>
              <div
                v-for="i in data.indicators.filter((x) => x.topic_id === t.id)"
                :key="i.id"
                class="mb-4 pa-3 border rounded"
              >
                <strong>{{ i.name }}</strong>
                <p>{{ i.description }}</p>
                <p class="muted">
                  น้ำหนัก {{ i.weight }} · {{ i.score_type }} · หลักฐาน
                  {{ i.evidence_mode }}
                  {{ i.evidence_required ? "(บังคับ)" : "(ไม่บังคับ)" }}
                </p>
                <div v-if="draft" class="actions mt-2">
                  <v-btn
                    size="small"
                    variant="text"
                    @click="openIndicator(t.id, i)"
                    >แก้ตัวชี้วัด</v-btn
                  ><v-btn
                    size="small"
                    variant="text"
                    color="error"
                    @click="remove('indicators', i.id)"
                    >ลบตัวชี้วัด</v-btn
                  >
                </div>
              </div></v-expansion-panel-text
            ></v-expansion-panel
          ></v-expansion-panels
        ></v-card
      >
      <v-card class="pa-5 mb-5"
        ><h2 class="text-h6 mb-4">2. ผู้รับการประเมิน</h2>
        <form v-if="draft" @submit.prevent="addPerson">
          <v-select
            v-model="personId"
            :items="users.filter((u) => u.role === 'evaluatee' && u.is_active)"
            item-title="full_name"
            item-value="id"
            label="เลือกผู้รับ"
          /><v-btn type="submit" color="primary" :disabled="!personId || busy"
            >เพิ่มผู้รับเข้ารอบ</v-btn
          >
        </form>
        <v-list
          ><v-list-item
            v-for="p in data.participants"
            :key="p.id"
            :title="p.full_name"
            :subtitle="p.status" /></v-list
      ></v-card>
      <v-card class="pa-5"
        ><h2 class="text-h6 mb-4">3. มอบหมายกรรมการ</h2>
        <form v-if="draft" @submit.prevent="addAssignment">
          <v-row
            ><v-col cols="12" md="4"
              ><v-select
                v-model="assign.participant_id"
                :items="data.participants"
                item-title="full_name"
                item-value="id"
                label="ผู้รับในรอบ" /></v-col
            ><v-col cols="12" md="4"
              ><v-select
                v-model="assign.evaluator_id"
                :items="
                  users.filter((u) => u.role === 'evaluator' && u.is_active)
                "
                item-title="full_name"
                item-value="id"
                label="กรรมการ" /></v-col
            ><v-col cols="12" md="4"
              ><v-select
                v-model="assign.committee_role"
                :items="[
                  { title: 'ประธาน', value: 'chair' },
                  { title: 'กรรมการร่วม', value: 'member' },
                ]"
                label="หน้าที่" /></v-col></v-row
          ><v-btn
            type="submit"
            color="primary"
            :disabled="!assign.participant_id || !assign.evaluator_id || busy"
            >มอบหมาย</v-btn
          >
        </form>
        <v-table class="mt-4"
          ><thead>
            <tr>
              <th>ผู้รับ</th>
              <th>กรรมการ</th>
              <th>หน้าที่</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in data.assignments" :key="a.id">
              <td>{{ a.evaluatee_name }}</td>
              <td>{{ a.evaluator_name }}</td>
              <td>
                {{ a.committee_role === "chair" ? "ประธาน" : "กรรมการร่วม" }}
              </td>
              <td>
                <v-btn
                  v-if="draft"
                  color="error"
                  variant="text"
                  size="small"
                  @click="remove('assignments', a.id)"
                  >ยกเลิกมอบหมาย</v-btn
                >
              </td>
            </tr>
          </tbody></v-table
        ></v-card
      >
    </template>
    <v-dialog v-model="indicatorDialog" max-width="650" :persistent="busy"
      ><v-card class="pa-6"
        ><h2 class="text-h6 mb-4">
          {{ indicator.id ? "แก้ตัวชี้วัด" : "เพิ่มตัวชี้วัด" }}
        </h2>
        <TaskStatus :error="error" />
        <form @submit.prevent="saveIndicator">
          <v-text-field
            v-model="indicator.name"
            label="ชื่อตัวชี้วัด"
            required
            maxlength="200"
          /><v-textarea
            v-model="indicator.description"
            label="รายละเอียด"
            rows="2"
          /><v-text-field
            v-model.number="indicator.weight"
            label="น้ำหนักคะแนน"
            type="number"
            min="0.01"
            max="999999.99"
            step="0.01"
            required
          /><v-select
            v-model="indicator.score_type"
            label="ชนิดคะแนน"
            :items="[
              { title: 'ระดับ 1–4', value: 'scale4' },
              { title: 'มี/ไม่มี', value: 'boolean' },
            ]"
          /><v-select
            v-model="indicator.evidence_mode"
            label="รูปแบบหลักฐาน"
            :items="[
              { title: 'ไม่ใช้', value: 'none' },
              { title: 'URL', value: 'url' },
              { title: 'ไฟล์ PDF/รูปภาพ', value: 'file' },
              { title: 'ไฟล์หรือ URL', value: 'either' },
            ]"
          /><v-checkbox
            v-model="indicator.evidence_required"
            label="บังคับแนบหลักฐาน"
          /><v-text-field
            v-model="indicator.evidence_instruction"
            label="คำแนะนำหลักฐาน"
            maxlength="500"
          />
          <div class="actions justify-end">
            <v-btn
              variant="text"
              :disabled="busy"
              @click="indicatorDialog = false"
              >ยกเลิก</v-btn
            ><v-btn color="primary" type="submit" :loading="busy"
              >บันทึกตัวชี้วัด</v-btn
            >
          </div>
        </form></v-card
      ></v-dialog
    >
    <v-dialog v-model="topicDialog" max-width="480"
      ><v-card class="pa-6"
        ><form @submit.prevent="saveTopic">
          <v-text-field
            v-model="topicEdit.name"
            label="ชื่อหัวข้อ"
            required
          /><v-textarea
            v-model="topicEdit.description"
            label="รายละเอียดหัวข้อ"
          /><TaskStatus :error="error" />
          <div class="actions">
            <v-btn variant="text" @click="topicDialog = false">ยกเลิก</v-btn
            ><v-btn type="submit" color="primary" :loading="busy"
              >บันทึกหัวข้อ</v-btn
            >
          </div>
        </form></v-card
      ></v-dialog
    >
  </section>
</template>
<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import api, { useTask, periodDate, periodDay } from "../api";
import TaskStatus from "../components/TaskStatus.vue";
const id = Number(useRoute().params.id),
  data = ref(null),
  users = ref([]),
  topicName = ref(""),
  personId = ref(null),
  assign = ref({
    participant_id: null,
    evaluator_id: null,
    committee_role: "chair",
  }),
  indicator = ref({}),
  indicatorDialog = ref(false),
  topicDialog = ref(false),
  topicEdit = ref({}),
  periodForm = ref({}),
  { busy, error, message, run } = useTask();
const draft = computed(() => data.value?.period.status === "draft");
async function load() {
  data.value = (await api.get(`/periods/${id}`)).data;
  users.value = (await api.get("/users")).data;
  periodForm.value = {
    ...data.value.period,
    starts_at: periodDay(data.value.period.starts_at),
    ends_at: periodDay(data.value.period.ends_at),
  };
}
onMounted(() => run(load));
function savePeriod() {
  run(async () => {
    await api.put(`/periods/${id}`, {
      ...periodForm.value,
      starts_at: periodForm.value.starts_at,
      ends_at: periodForm.value.ends_at,
    });
    await load();
  }, "บันทึกรอบแล้ว");
}
function action(name) {
  if (
    !confirm(
      {
        open: "เปิดรอบและตรึงชุดประเมิน?",
        close: "ปิดรอบ? ผู้ใช้จะบันทึกเพิ่มไม่ได้",
        publish: "เผยแพร่ผลให้ผู้รับเห็น?",
      }[name],
    )
  )
    return;
  run(async () => {
    await api.post(`/periods/${id}/${name}`);
    await load();
  }, "บันทึกสถานะรอบแล้ว");
}
function addTopic() {
  run(async () => {
    await api.post(`/periods/${id}/topics`, { name: topicName.value });
    topicName.value = "";
    await load();
  });
}
function editTopic(t) {
  topicEdit.value = { ...t, description: t.description || "" };
  topicDialog.value = true;
}
function saveTopic() {
  run(async () => {
    await api.put(`/topics/${topicEdit.value.id}`, topicEdit.value);
    topicDialog.value = false;
    await load();
  });
}
function openIndicator(topicId, i) {
  indicator.value = i
    ? {
        ...i,
        weight: Number(i.weight),
        evidence_required: !!i.evidence_required,
      }
    : {
        topic_id: topicId,
        name: "",
        description: "",
        weight: 1,
        score_type: "scale4",
        evidence_mode: "either",
        evidence_required: false,
        evidence_instruction: "",
      };
  error.value = "";
  indicatorDialog.value = true;
}
function saveIndicator() {
  run(async () => {
    if (indicator.value.id)
      await api.put(`/indicators/${indicator.value.id}`, indicator.value);
    else
      await api.post(
        `/topics/${indicator.value.topic_id}/indicators`,
        indicator.value,
      );
    indicatorDialog.value = false;
    await load();
  });
}
function addPerson() {
  run(async () => {
    await api.post(`/periods/${id}/participants`, {
      evaluatee_id: personId.value,
    });
    personId.value = null;
    await load();
  });
}
function addAssignment() {
  run(async () => {
    await api.post(
      `/participants/${assign.value.participant_id}/assignments`,
      assign.value,
    );
    await load();
  });
}
function remove(resource, target) {
  if (!confirm("ยืนยันลบรายการในฉบับร่าง?")) return;
  run(async () => {
    await api.delete(`/${resource}/${target}`);
    await load();
  });
}
</script>
