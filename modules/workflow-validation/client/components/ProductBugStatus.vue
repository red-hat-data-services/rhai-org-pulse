<template>
  <div class="space-y-1 text-xs">
    <template v-if="productBugs.length">
      <template v-for="issue in productBugs" :key="issue.id">
        <span
          v-if="issue.bug_key"
          :title="productBugTooltip(issue)"
          class="block font-semibold text-gray-600 dark:text-gray-300"
        >
          <a
            v-if="issue.jira_url"
            :href="issue.jira_url"
            target="_blank"
            rel="noopener"
            class="text-blue-600 dark:text-blue-400 underline decoration-dotted underline-offset-2"
            @click.stop
          >{{ issue.bug_key }}</a>
          <span v-else class="border-b border-dotted border-gray-400 cursor-help">{{ issue.bug_key }}</span>
          <span> — {{ productBugDescription(issue) }}</span>
        </span>
        <span
          v-else
          tabindex="0"
          :title="productBugTooltip(issue)"
          class="block w-fit font-semibold text-gray-600 dark:text-gray-300 border-b border-dotted border-gray-400 cursor-help"
        >{{ productBugMessage(issue) }}</span>
      </template>
    </template>
    <span
      v-else
      tabindex="0"
      :title="emptyTooltip"
      class="inline-block text-gray-500 dark:text-gray-400 border-b border-dotted border-gray-400 cursor-help"
    >{{ emptyMessage }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  findings: { type: Array, default: () => [] },
  verdict: { type: String, default: '' },
  neutralMessage: { type: String, default: 'No product bugs observed in the filtered executions.' },
  neutralTooltip: { type: String, default: 'No product bug was observed for this test in the selected version and date range.' }
})

const productBugs = computed(() => props.findings.filter((finding) => finding.category === 'PRODUCT_BUG'))
const unsuccessful = computed(() => ['FAIL', 'ERROR'].includes(String(props.verdict).toUpperCase()))
const emptyMessage = computed(() => unsuccessful.value
  ? 'Environmental failure detected. No product bug detected.'
  : props.neutralMessage)
const emptyTooltip = computed(() => unsuccessful.value
  ? 'The test failed or was terminated due to a problem in the test execution environment. No product bug was observed.'
  : props.neutralTooltip)

function productBugMessage() {
  return 'Existing product bug detected. Jira ID missing.'
}

function productBugDescription(issue) {
  if (issue.action === 'EXISTING' || issue.action === 'MATCH') return 'Pre-existing product bug detected.'
  if (issue.action === 'FILED' || issue.opened) return 'New product bug opened.'
  return 'Product bug detected.'
}

function productBugTooltip(issue) {
  if (!issue.bug_key) {
    return 'A Jira issue exists for this product bug, but its ID is missing from Org Pulse. This may indicate a data import problem or a problem publishing the telemetry.'
  }
  if (issue.action === 'EXISTING') {
    return 'The test failed after encountering an already reported bug. No new issue was opened, but a new occurrence was logged and the issue was updated.'
  }
  if (issue.action === 'FILED' || issue.opened) {
    return `A new product bug was detected. ${issue.bug_key} has been opened.`
  }
  return 'A product bug was detected, but its issue-handling status is unavailable.'
}
</script>
