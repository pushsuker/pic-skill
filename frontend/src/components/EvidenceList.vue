<template>
  <div class="mt-3">
    <div v-for="e in items" :key="e.id" class="actions mb-2">
      <a
        v-if="e.kind === 'url'"
        :href="e.url"
        target="_blank"
        rel="noopener noreferrer"
        >{{ e.url }}</a
      ><v-btn
        v-else
        variant="text"
        size="small"
        prepend-icon="mdi-file"
        :loading="opening === e.id"
        @click="open(e)"
        >{{ e.original_name }}</v-btn
      ><v-btn
        v-if="editable"
        size="small"
        color="error"
        variant="text"
        :disabled="disabled"
        @click="$emit('remove', e.id)"
        >ลบหลักฐาน</v-btn
      >
    </div>
    <p v-if="!items.length" class="muted">ยังไม่มีหลักฐาน</p>
    <v-alert v-if="error" type="error" variant="tonal">{{ error }}</v-alert>
  </div>
</template>
<script setup>
import { ref } from "vue";
import { fileUrl } from "../api";
defineProps({
  items: { type: Array, default: () => [] },
  editable: Boolean,
  disabled: Boolean,
});
defineEmits(["remove"]);
const error = ref(""),
  opening = ref(null);
async function open(e) {
  opening.value = e.id;
  error.value = "";
  try {
    const url = await fileUrl(e.file_id);
    const a = document.createElement("a");
    a.href = url;
    a.download = e.original_name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    error.value = e.message;
  } finally {
    opening.value = null;
  }
}
</script>
