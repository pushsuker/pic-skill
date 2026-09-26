<template>
  <section>
    <div class="toolbar no-print">
      <h1 class="page-title">รายงานรายบุคคล</h1>
      <div class="actions">
        <v-btn to="/" variant="text">กลับหน้าหลัก</v-btn
        ><v-btn
          color="primary"
          :disabled="busy || !data"
          @click="exportPdf"
          >Export PDF</v-btn
        >
      </div>
    </div>
    <TaskStatus :busy="busy" :error="error" />
    <v-btn v-if="error || Object.keys(signatureErrors).length" class="no-print mb-4" :disabled="busy" @click="loadResult">
      ลองโหลดรายงานอีกครั้ง
    </v-btn>
    <p v-if="data" class="no-print muted mb-4">Export PDF จะเปิดหน้าต่างพิมพ์ ให้เลือกบันทึกเป็น PDF (Save as PDF)</p>
    <template v-if="data"
      ><h1 class="page-title print-title mb-3">
        ผลการประเมิน {{ data.participant.full_name }}
      </h1>
      <p>{{ data.period.name }} · ปี {{ data.period.eval_year }}</p>
      <p>
        แผนก {{ data.participant.department || "—" }} · ตำแหน่ง
        {{ data.participant.position || "—" }}
      </p>
      <p class="my-4 font-weight-bold">
        คะแนนรวม {{ number(data.percentage) }}% · {{ data.result }} ·
        {{ data.complete ? "กรรมการส่งครบ" : "ผลยังไม่ครบ" }}
      </p>
      <v-alert
        v-if="!data.period.published_at"
        variant="tonal"
        type="warning"
        class="mb-4"
        >ยังไม่เผยแพร่ ผู้รับยังเปิดรายงานนี้ไม่ได้</v-alert
      >
      <v-card
        v-for="a in data.assignments"
        :key="a.id"
        class="pa-4 mb-5 committee-result"
        ><h2 class="text-h6">
          {{ a.evaluator_name }} ·
          {{ a.committee_role === "chair" ? "ประธาน" : "กรรมการร่วม" }}
        </h2>
        <p class="my-3">
          คะแนน {{ number(a.percentage) }}% ·
          {{ a.status === "submitted" ? "ยืนยันแล้ว" : "เบื้องต้น" }} ·
          {{ date(a.submitted_at) }}
        </p>
        <v-table
          ><thead>
            <tr>
              <th>หัวข้อ / ตัวชี้วัด</th>
              <th>น้ำหนัก</th>
              <th>ตนเอง</th>
              <th>กรรมการ</th>
              <th>หลักฐาน</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="i in data.indicators" :key="i.id">
              <td>
                {{ i.topic_name }} / {{ i.name }}<br /><small>{{
                  i.description
                }}</small>
              </td>
              <td>{{ i.weight }}</td>
              <td>{{ i.self_score ?? "—" }}</td>
              <td>
                {{
                  a.scores.find((s) => s.indicator_id === i.id)?.score ?? "—"
                }}
              </td>
              <td><EvidenceList :items="i.evidence" /></td>
            </tr></tbody
        ></v-table>
        <p class="my-4">ความคิดเห็น: {{ a.overall_feedback || "—" }}</p>
        <div class="signature-block text-center">
          <img
            v-if="signatures[a.id]"
            :src="signatures[a.id]"
            alt="ลายเซ็นกรรมการ"
            class="signature"
          />
          <p v-if="signatureErrors[a.id]" class="text-error">
            โหลดลายเซ็นไม่ได้: {{ signatureErrors[a.id] }}
          </p>
          <p>{{ a.evaluator_name }}</p>
        </div></v-card
      >
      <p class="muted">
        สูตร weighted-v1: ปรับคะแนนตามคะแนนเต็มของแต่ละชนิด ถ่วงด้วยน้ำหนัก
        แล้วเฉลี่ยกรรมการเท่ากันเมื่อส่งครบ
      </p></template
    >
  </section>
</template>
<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import api, { useTask, number, date, fileUrl } from "../api";
import TaskStatus from "../components/TaskStatus.vue";
import EvidenceList from "../components/EvidenceList.vue";
const id = Number(useRoute().params.id),
  data = ref(null),
  signatures = ref({}),
  signatureErrors = ref({}),
  { busy, error, run } = useTask();
let disposed = false;
function clearSignatures() {
  Object.values(signatures.value).forEach((url) => URL.revokeObjectURL(url));
  signatures.value = {};
}
function loadResult() {
  return run(async () => {
    data.value = null;
    clearSignatures();
    signatureErrors.value = {};
    data.value = (await api.get(`/participants/${id}/result`)).data;
    await Promise.all(data.value.assignments.map(async (a) => {
      if (!a.signature_file_id || disposed) return;
      let url;
      try {
        url = await fileUrl(a.signature_file_id);
        const img = new Image();
        img.src = url;
        await img.decode();
        if (disposed) URL.revokeObjectURL(url);
        else signatures.value[a.id] = url;
      } catch (e) {
        if (url) URL.revokeObjectURL(url);
        signatureErrors.value[a.id] = url ? "ไฟล์ภาพลายเซ็นเสียหาย กรุณาให้ผู้ดูแลตรวจสอบ" : e.message;
      }
    }));
  });
}
onMounted(loadResult);
onUnmounted(() => {
  disposed = true;
  clearSignatures();
});
function exportPdf() {
  run(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.querySelectorAll(".signature")].map((img) => img.decode()),
    );
    const old = document.title;
    document.title = `ผลประเมิน-${data.value.participant.full_name}`;
    try {
      window.print();
    } finally {
      document.title = old;
    }
  });
}
</script>
