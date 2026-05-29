<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { detectCapabilities, type ClientCapabilityReport } from '../../../src/featureDetect';

const report = ref<ClientCapabilityReport | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    report.value = await detectCapabilities();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <ClientOnly>
    <div class="device-panel">
      <p v-if="loading">Probing your device…</p>
      <ul v-else-if="report">
        <li>
          WebAuthn available: <strong>{{ String(report.webauthnAvailable) }}</strong>
        </li>
        <li>
          Platform authenticator (isUVPAA): <strong>{{ String(report.isUvpaa) }}</strong>
        </li>
        <li>
          Conditional UI: <strong>{{ String(report.conditionalMediation) }}</strong>
        </li>
        <li v-if="report.clientCapabilities">
          getClientCapabilities(): <code>{{ JSON.stringify(report.clientCapabilities) }}</code>
        </li>
        <li>
          User agent: <code>{{ report.userAgent }}</code>
        </li>
      </ul>
    </div>
  </ClientOnly>
</template>
