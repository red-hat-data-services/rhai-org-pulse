<template>
  <div class="p-6">
    <div v-if="!selectedReport">
      <ReportsHub @select="selectReport" />
    </div>
    <div v-else>
      <button
        class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 mb-4"
        @click="clearReport"
      >
        &larr; Back to Reports
      </button>
      <component :is="selectedReport.component" :initialProduct="initialProduct" :initialVersion="initialVersion" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, inject, nextTick } from 'vue'
import ReportsHub from '../reports/ReportsHub.vue'
import { reports } from '../reports/registry'

const nav = inject('moduleNav')
const selectedReport = ref(null)
const initialProduct = ref(null)
const initialVersion = ref(null)
let updatingFromUrl = false

function selectReport(report) {
  selectedReport.value = report
  if (!updatingFromUrl) {
    nav.updateParams({ report: report.id })
  }
}

function clearReport() {
  selectedReport.value = null
  initialProduct.value = null
  initialVersion.value = null
  if (!updatingFromUrl) {
    nav.updateParams({ report: undefined, product: undefined, version: undefined })
  }
}

// Restore report from URL params (e.g. returning from feature detail)
watch(() => nav.params.value, (params) => {
  const reportId = params?.report
  if (reportId && !selectedReport.value) {
    const report = reports.find(r => r.id === reportId)
    if (report) {
      updatingFromUrl = true
      initialProduct.value = params.product || null
      initialVersion.value = params.version || null
      selectedReport.value = report
      nextTick(() => { updatingFromUrl = false })
    }
  }
}, { immediate: true })
</script>
