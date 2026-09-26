<template>
  <section>
    <div class="toolbar">
      <h1 class="page-title">ประเมิน: {{ data?.participant.full_name }}</h1>
      <v-btn to="/" variant="text">กลับงานของฉัน</v-btn>
    </div>
    <TaskStatus :busy="busy" :error="error" :message="message" />
    <template v-if="data"
      ><p class="mb-4">
        {{ data.period.name }} · หน้าที่
        {{
          data.assignment.committee_role === "chair" ? "ประธาน" : "กรรมการร่วม"
        }}
        · {{ data.assignment.status }}
      </p>
      <v-alert v-if="!editable" type="info" variant="tonal" class="mb-4">{{
        data.assignment.status === "submitted"
          ? "ส่งแล้ว แก้ไขไม่ได้"
          : data.participant.status !== "submitted"
            ? "รอผู้รับส่งการประเมินตนเอง"
            : "อยู่นอกช่วงเปิดประเมิน"
      }}</v-alert>
      <v-card v-for="i in data.indicators" :key="i.id" class="pa-5 mb-4"
        ><p class="text-primary">{{ i.topic_name }}</p>
        <h2 class="text-h6">{{ i.name }}</h2>
        <p class="my-2">{{ i.description }}</p>
        <p class="muted">
          น้ำหนัก {{ i.weight }} · คะแนนตนเอง {{ i.self_score ?? "—" }}
        </p>
        <p class="my-3">ข้อมูลผู้รับ: {{ i.narrative || "—" }}</p>
        <EvidenceList :items="i.evidence" />
        <div class="mt-4">
          <ScoreInput
            v-model="scores[i.id]"
            :type="i.score_type"
            label="คะแนนกรรมการ"
            :disabled="!editable || busy"
            @update:model-value="dirty[i.id] = true"
          />
        </div>
        <div class="actions mt-3">
          <v-btn
            v-if="editable"
            variant="tonal"
            color="primary"
            :disabled="busy || scores[i.id] === null"
            @click="saveScore(i)"
            >บันทึกคะแนนข้อนี้</v-btn
          ><v-chip v-if="dirty[i.id]" color="warning" size="small"
            >ยังไม่บันทึก</v-chip
          >
        </div></v-card
      >
      <v-card class="pa-5 mb-5"
        ><h2 class="text-h6 mb-4">ตรวจทานผลก่อนส่ง</h2>
        <v-table
          ><thead>
            <tr>
              <th>ตัวชี้วัด</th>
              <th>น้ำหนัก</th>
              <th>คะแนน</th>
              <th>คะแนนถ่วงน้ำหนัก</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in data.indicators" :key="i.id">
              <td>{{ i.name }}</td>
              <td>{{ i.weight }}</td>
              <td>{{ scores[i.id] ?? "—" }}</td>
              <td>
                {{
                  scores[i.id] === null
                    ? "—"
                    : number(
                        (Number(i.weight) * scores[i.id]) /
                          (i.score_type === "boolean" ? 1 : 4),
                      )
                }}
              </td>
            </tr>
          </tbody></v-table
        >
        <p class="my-4 font-weight-bold">
          คะแนนรวมของกรรมการนี้: {{ number(total) }}%
        </p>
        <v-textarea
          v-model="feedback"
          label="ความคิดเห็นสรุปภาพรวม"
          rows="3"
          :disabled="!editable || busy"
        /><v-file-input
          v-if="editable"
          v-model="signatureFile"
          label="แนบลายเซ็น PNG/JPEG"
          accept="image/png,image/jpeg"
          hint="ต้องแนบก่อนส่ง ไม่เกิน 512 KB"
          persistent-hint
          :disabled="busy"
        /><v-btn
          v-if="editable"
          class="my-3"
          variant="outlined"
          :disabled="busy || !signatureFile"
          @click="uploadSignature"
          >บันทึกลายเซ็น</v-btn
        >
        <div v-if="signatureUrl">
          <img :src="signatureUrl" class="signature" alt="ลายเซ็นกรรมการ" />
        </div>
        <p v-if="data.assignment.status === 'submitted'">
          ส่งเมื่อ {{ date(data.assignment.submitted_at) }}
        </p></v-card
      >
      <v-btn
        v-if="editable"
        color="secondary"
        block
        size="large"
        :disabled="busy || !canSubmit"
        @click="submit"
        >ยืนยันและส่งผลการประเมิน</v-btn
      >
      <p v-if="editable" class="muted mt-3">
        ต้องบันทึกคะแนนครบ มีความคิดเห็น และบันทึกลายเซ็นก่อนส่ง
      </p></template
    >
  </section>
</template>
<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import api, { useTask, isOpen, number, date, fileUrl } from "../api";
import TaskStatus from "../components/TaskStatus.vue";
import EvidenceList from "../components/EvidenceList.vue";
import ScoreInput from "../components/ScoreInput.vue";
const id = Number(useRoute().params.id),
  data = ref(null),
  scores = ref({}),
  dirty = ref({}),
  feedback = ref(""),
  signatureFile = ref(null),
  signatureUrl = ref(""),
  { busy, error, message, run } = useTask();
const editable = computed(
  () =>
    isOpen(data.value?.period) &&
    data.value?.assignment.status !== "submitted" &&
    data.value?.participant.status === "submitted",
);
const total = computed(() => {
  const rows = data.value?.indicators;
  if (!rows?.length || rows.some((i) => scores.value[i.id] === null))
    return null;
  return (
    (rows.reduce(
      (sum, i) =>
        sum +
        (Number(i.weight) * scores.value[i.id]) /
          (i.score_type === "boolean" ? 1 : 4),
      0,
    ) /
      rows.reduce((sum, i) => sum + Number(i.weight), 0)) *
    100
  );
});
const canSubmit = computed(
  () =>
    total.value !== null &&
    !Object.values(dirty.value).some(Boolean) &&
    feedback.value.trim() &&
    data.value?.assignment.signature_file_id,
);
async function signature() {
  if (signatureUrl.value) URL.revokeObjectURL(signatureUrl.value);
  signatureUrl.value = data.value.assignment.signature_file_id
    ? await fileUrl(data.value.assignment.signature_file_id)
    : "";
}
async function load() {
  data.value = (await api.get(`/assignments/${id}`)).data;
  for (const i of data.value.indicators) {
    scores.value[i.id] =
      data.value.scores.find((s) => s.indicator_id === i.id)?.score ?? null;
    dirty.value[i.id] = false;
  }
  feedback.value = data.value.assignment.overall_feedback || "";
  await signature();
}
onMounted(() => run(load));
onUnmounted(() => {
  if (signatureUrl.value) URL.revokeObjectURL(signatureUrl.value);
});
function saveScore(i) {
  run(async () => {
    await api.put(`/assignments/${id}/scores/${i.id}`, {
      score: scores.value[i.id],
    });
    dirty.value[i.id] = false;
    data.value.assignment.status = "in_progress";
  }, "บันทึกคะแนนแล้ว");
}
function uploadSignature() {
  run(async () => {
    const f = Array.isArray(signatureFile.value)
      ? signatureFile.value[0]
      : signatureFile.value;
    if (!f) throw new Error("เลือกไฟล์");
    const form = new FormData();
    form.append("file", f);
    data.value.assignment.signature_file_id = (
      await api.post(`/assignments/${id}/signature`, form)
    ).data.id;
    signatureFile.value = null;
    await signature();
  }, "บันทึกลายเซ็นแล้ว");
}
function submit() {
  if (!confirm("ยืนยันและล็อกผลของคุณ? กรรมการคนอื่นยังทำงานต่อได้")) return;
  run(async () => {
    await api.post(`/assignments/${id}/submit`, {
      overall_feedback: feedback.value,
    });
    await load();
  }, "ส่งผลแล้ว");
}
</script>
