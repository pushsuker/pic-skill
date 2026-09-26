<template>
  <v-progress-linear
    v-if="busy"
    indeterminate
    color="primary"
    class="mb-4"
  /><v-alert
    v-if="error"
    type="error"
    variant="tonal"
    class="mb-4"
    role="alert"
    >{{ error }}</v-alert
  ><v-alert
    v-if="message"
    type="success"
    variant="tonal"
    class="mb-4"
    role="status"
    >{{ message }}</v-alert
  >
</template>
<script setup>
defineProps({ busy: Boolean, error: String, message: String });
</script>
