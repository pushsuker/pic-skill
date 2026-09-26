<template>
  <section>
    <div class="toolbar no-print">
      <h1 class="page-title">ติดตาม / รายงาน: {{ data?.period.name }}</h1>
      <div class="actions">
        <v-btn :to="`/admin/period/${id}`" variant="text">จัดการรอบ</v-btn
        ><v-btn :disabled="busy || !data" @click="printReport"
          >พิมพ์รายงาน</v-btn
        ><v-btn :disabled="busy || !data" @click="csv">Export CSV</v-btn>
      </div>
    </div>
    <TaskStatus :busy="busy" :error="error" />
    <template v-if="data"
      ><h2 class="text-h6 mb-4">{{ data.period.name }}</h2>
      <div class="actions mb-5 print-summary">
        <v-chip>ทั้งหมด {{ data.statistics.total }} คน</v-chip
        ><v-chip color="success">ครบ {{ data.statistics.completed }} คน</v-chip
        ><v-chip color="warning">ค้าง {{ data.statistics.pending }} คน</v-chip
        ><v-chip color="primary"
          >ค่าเฉลี่ย {{ number(data.statistics.average) }}% (เฉพาะ
          {{ data.statistics.completed }} คนที่ครบ)</v-chip
        >
      </div>
      <v-card
        ><v-table
          ><thead>
            <tr>
              <th>ผู้รับ</th>
              <th>ตนเองครบ</th>
              <th>สถานะตนเอง</th>
              <th>กรรมการส่ง</th>
              <th>คะแนนรวม</th>
              <th>ผล</th>
              <th class="no-print">รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in data.rows" :key="r.participant.id">
              <td>{{ r.participant.full_name }}</td>
              <td>{{ r.self_completed }}/{{ r.indicators.length }}</td>
              <td>{{ r.participant.status }}</td>
              <td>
                {{
                  r.assignments.filter((a) => a.status === "submitted").length
                }}/{{ r.assignments.length }}
              </td>
              <td>{{ number(r.percentage) }}%</td>
              <td>{{ r.result }}</td>
              <td class="no-print">
                <v-btn
                  size="small"
                  variant="text"
                  :to="`/result/${r.participant.id}`"
                  >ดูรายบุคคล</v-btn
                >
              </td>
            </tr>
          </tbody></v-table
        ></v-card
      >
      <v-card v-for="r in data.rows" :key="r.participant.id" class="pa-5 mt-5"
        ><h2 class="text-h6 mb-3">
          สถานะกรรมการ: {{ r.participant.full_name }}
        </h2>
        <v-table
          ><thead>
            <tr>
              <th>กรรมการ</th>
              <th>หน้าที่</th>
              <th>ให้คะแนนครบ</th>
              <th>สถานะ</th>
              <th>คะแนนกรรมการ</th>
              <th>ความคิดเห็นหลังส่ง</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in r.assignments" :key="a.id">
              <td>{{ a.evaluator_name }}</td>
              <td>{{ a.committee_role }}</td>
              <td>{{ a.completed }}/{{ r.indicators.length }}</td>
              <td>{{ a.status }}</td>
              <td>
                {{ number(a.percentage) }}%
                {{ a.status === "submitted" ? "" : "(เบื้องต้น)" }}
              </td>
              <td>{{ a.overall_feedback || "—" }}</td>
            </tr>
          </tbody></v-table
        ></v-card
      ></template
    >
  </section>
</template>
<script setup>
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import api, { useTask, number } from "../api";
import TaskStatus from "../components/TaskStatus.vue";
const id = Number(useRoute().params.id),
  data = ref(null),
  { busy, error, run } = useTask();
onMounted(() =>
  run(async () => {
    data.value = (await api.get(`/periods/${id}/report`)).data;
  }),
);
async function printReport() {
  await document.fonts.ready;
  window.print();
}
function csv() {
  const cell = (v) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const rows = [
    ["ผู้รับ", "คะแนน", "ผล", "กรรมการส่ง"],
    ...data.value.rows.map((r) => [
      r.participant.full_name,
      r.percentage,
      r.result,
      r.assignments.filter((a) => a.status === "submitted").length,
    ]),
  ];
  const url = URL.createObjectURL(
    new Blob(["\ufeff" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `report-${id}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
</script>
