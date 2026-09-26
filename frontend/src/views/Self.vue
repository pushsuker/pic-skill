<template>
  <section>
    <div class="toolbar">
      <h1 class="page-title">ประเมินตนเอง: {{ data?.period.name }}</h1>
      <v-btn to="/" variant="text">กลับ</v-btn>
    </div>
    <TaskStatus :busy="busy" :error="error" :message="message" />
    <template v-if="data"
      ><v-alert v-if="!editable" type="info" variant="tonal" class="mb-4">{{
        data.participant.status === "submitted"
          ? "ส่งตนเองแล้ว ข้อมูลถูกล็อก"
          : "รอบยังไม่เปิดหรือปิดแล้ว อ่านข้อมูลได้อย่างเดียว"
      }}</v-alert
      ><v-card class="pa-4 mb-5"
        ><div class="actions">
          <strong
            >บันทึกครบ {{ completed }} /
            {{ data.indicators.length }} ตัวชี้วัด</strong
          ><v-chip>{{ data.participant.status }}</v-chip
          ><v-btn
            v-if="data.period.published_at"
            :to="`/result/${data.participant.id}`"
            color="secondary"
            >ดูผล / PDF</v-btn
          >
        </div>
        <v-progress-linear
          :model-value="
            data.indicators.length
              ? (completed / data.indicators.length) * 100
              : 0
          "
          color="primary"
          class="mt-4"
      /></v-card>
      <v-card v-for="i in data.indicators" :key="i.id" class="pa-5 mb-4"
        ><p class="text-primary">{{ i.topic_name }}</p>
        <h2 class="text-h6">{{ i.name }}</h2>
        <p class="my-2">{{ i.description }}</p>
        <p class="muted mb-4">
          น้ำหนัก {{ i.weight }} · {{ i.evidence_instruction }}
          {{ i.evidence_required ? "(หลักฐานบังคับ)" : "" }}
        </p>
        <v-textarea
          v-model="i.narrative"
          label="รายละเอียดการดำเนินงาน"
          rows="2"
          :disabled="!editable || busy"
          @update:model-value="i.dirty = true"
        />
        <ScoreInput
          v-model="i.self_score"
          :type="i.score_type"
          label="คะแนนตนเอง"
          :disabled="!editable || busy"
          @update:model-value="i.dirty = true"
        />
        <div class="actions my-4">
          <v-btn
            v-if="editable"
            color="primary"
            variant="tonal"
            :disabled="busy"
            @click="save(i)"
            >บันทึกข้อนี้</v-btn
          ><v-chip
            size="small"
            :color="i.dirty ? 'warning' : ready(i) ? 'success' : 'secondary'"
            >{{
              i.dirty
                ? "มีการแก้ไข ยังไม่บันทึก"
                : ready(i)
                  ? "ครบแล้ว"
                  : i.self_score === null
                    ? "ขาดคะแนน"
                    : "ขาดหลักฐาน"
            }}</v-chip
          >
        </div>
        <EvidenceList
          :items="i.evidence"
          :editable="editable"
          :disabled="busy"
          @remove="removeEvidence(i, $event)"
        />
        <template v-if="editable && i.evidence_mode !== 'none'"
          ><p v-if="!i.self_id" class="muted mt-3">
            บันทึกฉบับร่างข้อนี้ก่อนแนบหลักฐาน
          </p>
          <div v-else class="mt-4">
            <form
              v-if="['url', 'either'].includes(i.evidence_mode)"
              @submit.prevent="addUrl(i)"
            >
              <v-text-field
                v-model="urls[i.id]"
                label="URL หลักฐาน"
                type="url"
                required
                :disabled="busy"
              /><v-btn type="submit" variant="outlined" :disabled="busy"
                >แนบ URL</v-btn
              >
            </form>
            <form
              v-if="['file', 'either'].includes(i.evidence_mode)"
              @submit.prevent="addFile(i)"
              class="mt-4"
            >
              <v-file-input
                v-model="files[i.id]"
                label="ไฟล์หลักฐาน PDF / PNG / JPEG"
                accept="application/pdf,image/png,image/jpeg"
                hint="ไม่เกิน 5 MB ต่อไฟล์"
                persistent-hint
                :disabled="busy"
              /><v-btn
                class="mt-3"
                type="submit"
                variant="outlined"
                :disabled="busy || !files[i.id]"
                >อัปโหลดหลักฐาน</v-btn
              >
            </form>
          </div></template
        > </v-card
      ><v-btn
        v-if="editable"
        block
        size="large"
        color="secondary"
        :disabled="
          busy ||
          !data.indicators.length ||
          completed !== data.indicators.length
        "
        @click="submit"
        >ส่งการประเมินตนเอง</v-btn
      >
      <p v-if="editable" class="muted mt-3">
        บันทึกทุกข้อและแนบหลักฐานที่บังคับให้ครบก่อนส่ง
        หลังส่งจะเปลี่ยนแปลงไม่ได้
      </p></template
    >
  </section>
</template>
<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import api, { useTask, isOpen } from "../api";
import TaskStatus from "../components/TaskStatus.vue";
import ScoreInput from "../components/ScoreInput.vue";
import EvidenceList from "../components/EvidenceList.vue";
const id = Number(useRoute().params.id),
  data = ref(null),
  files = ref({}),
  urls = ref({}),
  { busy, error, message, run } = useTask();
const editable = computed(
  () =>
    isOpen(data.value?.period) && data.value?.participant.status === "draft",
);
const ready = (i) =>
  !i.dirty &&
  i.self_score !== null &&
  (!i.evidence_required || i.evidence.length > 0);
const completed = computed(
  () => data.value?.indicators.filter(ready).length || 0,
);
async function load() {
  data.value = (await api.get(`/periods/${id}/me/assessment`)).data;
  data.value.indicators.forEach((i) => {
    i.dirty = false;
    i.narrative = i.narrative || "";
  });
}
onMounted(() => run(load));
function save(i) {
  run(async () => {
    i.self_id = (
      await api.put(
        `/participants/${data.value.participant.id}/self-assessments/${i.id}`,
        { score: i.self_score, narrative: i.narrative },
      )
    ).data.id;
    i.dirty = false;
  }, "บันทึกข้อนี้แล้ว");
}
async function refreshEvidence(i) {
  const fresh = (
    await api.get(`/periods/${id}/me/assessment`)
  ).data.indicators.find((r) => r.id === i.id);
  i.evidence = fresh.evidence;
}
function addUrl(i) {
  run(async () => {
    await api.post(`/self-assessments/${i.self_id}/evidence`, {
      url: urls.value[i.id],
    });
    urls.value[i.id] = "";
    await refreshEvidence(i);
  }, "แนบ URL แล้ว");
}
function addFile(i) {
  run(async () => {
    const file = Array.isArray(files.value[i.id])
      ? files.value[i.id][0]
      : files.value[i.id];
    if (!file) throw new Error("เลือกไฟล์");
    const form = new FormData();
    form.append("file", file);
    await api.post(`/self-assessments/${i.self_id}/evidence`, form);
    files.value[i.id] = null;
    await refreshEvidence(i);
  }, "อัปโหลดแล้ว");
}
function removeEvidence(i, eid) {
  if (!confirm("ลบหลักฐานรายการนี้?")) return;
  run(async () => {
    await api.delete(`/evidence/${eid}`);
    await refreshEvidence(i);
  });
}
function submit() {
  if (!confirm("ส่งและล็อกข้อมูลตนเอง?")) return;
  run(async () => {
    await api.post(`/participants/${data.value.participant.id}/submit`);
    await load();
  }, "ส่งตนเองแล้ว");
}
</script>
