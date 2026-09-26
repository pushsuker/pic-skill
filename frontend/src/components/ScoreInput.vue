<template>
  <v-select
    class="score-select"
    :model-value="modelValue"
    :items="items"
    :label="label"
    :disabled="disabled"
    hide-details="auto"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>
<script setup>
import { computed } from "vue";
const props = defineProps({
  type: String,
  modelValue: { default: null },
  disabled: Boolean,
  label: { default: "คะแนน" },
});
defineEmits(["update:modelValue"]);
const items = computed(() =>
  props.type === "boolean"
    ? [
        { title: "ไม่มี (0)", value: 0 },
        { title: "มี (1)", value: 1 },
      ]
    : [
        { title: "1 — ต่ำกว่าที่คาดหวังมาก", value: 1 },
        { title: "2 — ต่ำกว่าที่คาดหวัง", value: 2 },
        { title: "3 — ตามที่คาดหวัง", value: 3 },
        { title: "4 — สูงกว่าที่คาดหวัง", value: 4 },
      ],
);
</script>
