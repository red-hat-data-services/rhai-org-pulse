<template>
  <div class="px-6 py-4 border-l-4" :class="accent">
    <div class="flex items-start gap-3 flex-wrap">
      <a
        v-if="safeExternalUrl(bug.jira_url)"
        :href="safeExternalUrl(bug.jira_url)"
        target="_blank"
        rel="noopener"
        class="font-mono font-semibold text-sm text-blue-600 dark:text-blue-400 hover:underline shrink-0"
      >{{ bug.bug_key || 'Jira' }}</a>
      <span
        class="inline-block px-2.5 py-0.5 rounded-full text-[0.68rem] font-semibold"
        :class="issueOutcome.tone"
        :title="issueOutcome.detail"
      >{{ issueOutcome.label }}</span>

      <p class="flex-1 min-w-[200px] text-sm text-gray-700 dark:text-gray-300">{{ bug.error_summary || '—' }}</p>
    </div>
    <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
      <span v-if="bug.rhoaieng_component || bug.component">{{ bug.rhoaieng_component || bug.component }}</span>
      <span v-if="bug.rhoai_version">Version {{ bug.rhoai_version }}</span>
      <span v-if="bug.workflow">Test: {{ bug.workflow }}</span>
      <span v-if="bug.status">Status: {{ bug.status }}</span>
      <span v-if="bug.confidence">Confidence: {{ bug.confidence }}</span>
      <button v-if="bug.execution_id" class="font-medium text-blue-600 hover:underline dark:text-blue-400" @click="$emit('open-test', bug.execution_id)">View test execution →</button>
    </div>
    <details v-if="hasDetails" class="mt-3 text-sm">
      <summary class="w-fit cursor-pointer select-none font-medium text-blue-600 hover:underline dark:text-blue-400">
        Finding details
      </summary>
      <div class="mt-3 rounded-lg bg-gray-50 p-4 dark:bg-gray-900/40">
        <dl v-if="detailFacts.length" class="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="fact in detailFacts" :key="fact.label">
            <dt class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ fact.label }}</dt>
            <dd class="mt-0.5 text-gray-800 dark:text-gray-200">{{ fact.value }}</dd>
          </div>
        </dl>
        <div v-if="bug.reasoning" class="mt-4 first:mt-0">
          <h4 class="font-semibold text-gray-800 dark:text-gray-200">Why this was classified</h4>
          <p class="mt-1 whitespace-pre-line text-gray-600 dark:text-gray-300">{{ bug.reasoning }}</p>
        </div>
        <div v-if="bug.workaround" class="mt-4">
          <h4 class="font-semibold text-gray-800 dark:text-gray-200">Workaround</h4>
          <p class="mt-1 whitespace-pre-line text-gray-600 dark:text-gray-300">{{ bug.workaround }}</p>
        </div>
        <div v-if="bug.suggested_remediation" class="mt-4">
          <h4 class="font-semibold text-gray-800 dark:text-gray-200">Suggested remediation</h4>
          <p class="mt-1 whitespace-pre-line text-gray-600 dark:text-gray-300">{{ bug.suggested_remediation }}</p>
        </div>
        <a
          v-if="safeExternalUrl(bug.spec_fix_mr_url)"
          :href="safeExternalUrl(bug.spec_fix_mr_url)"
          target="_blank"
          rel="noopener"
          class="mt-4 inline-block font-medium text-blue-600 hover:underline dark:text-blue-400"
        >Open spec-fix merge request</a>
      </div>
    </details>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { safeExternalUrl } from '../utils/external-url'
const props = defineProps({
  bug: { type: Object, required: true }
})
defineEmits(['open-test'])

const issueOutcome = computed(() => {
  if (props.bug.category && props.bug.category !== 'PRODUCT_BUG') return {
    label: {
      ENVIRONMENT: 'Environment failure',
      SPEC_DEFECT: 'Test specification defect',
      AUTOMATION_BUG: 'Test automation defect',
      CREDENTIAL_EXPOSURE: 'Credential exposure'
    }[props.bug.category] || 'Non-product failure',
    detail: `The RCA classified this finding as ${String(props.bug.category).toLowerCase().replaceAll('_', ' ')} rather than a product bug.`,
    tone: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
  }
  if (!props.bug.bug_key) return {
    label: 'Jira ID missing',
    detail: 'A Jira issue exists for this product bug, but its ID is missing from Org Pulse. This may indicate a data import problem or a problem publishing the telemetry.',
    tone: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
  }
  if (props.bug.action === 'FILED' || props.bug.opened) return {
    label: 'New Jira issue opened',
    detail: `${props.bug.bug_key} was opened for this newly detected product bug.`,
    tone: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
  }
  if (props.bug.action === 'EXISTING' || props.bug.action === 'MATCH') return {
    label: 'Existing Jira issue encountered',
    detail: `This occurrence matched the previously reported product bug ${props.bug.bug_key}; no new issue was opened.`,
    tone: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300'
  }
  return {
    label: 'Jira handling unknown',
    detail: `The telemetry identifies ${props.bug.bug_key}, but does not say whether the issue was new or pre-existing.`,
    tone: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  }
})

const detailFacts = computed(() => [
  { label: 'Severity', value: props.bug.severity },
  { label: 'Reproducibility', value: props.bug.reproducibility },
  { label: 'Affected page', value: props.bug.affected_page },
  { label: 'Issue status', value: props.bug.status },
  { label: 'Resolution', value: props.bug.resolution }
].filter((fact) => fact.value))

const hasDetails = computed(() => detailFacts.value.length > 0 || Boolean(
  props.bug.reasoning || props.bug.workaround || props.bug.suggested_remediation || props.bug.spec_fix_mr_url
))

// Left accent echoes the report's priority stripe, keyed off category.
const accent = computed(() => {
  const c = String(props.bug.category || '').toUpperCase()
  if (c === 'PRODUCT_BUG' || c === 'CREDENTIAL_EXPOSURE') return 'border-red-500'
  if (c === 'ENVIRONMENT') return 'border-amber-500'
  if (c === 'SPEC_DEFECT') return 'border-yellow-500'
  if (c === 'AUTOMATION_BUG') return 'border-purple-500'
  return 'border-gray-300 dark:border-gray-600'
})
</script>
