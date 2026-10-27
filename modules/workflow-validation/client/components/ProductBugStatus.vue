<template>
  <div class="space-y-1 text-xs">
    <template v-if="visibleIssues.length">
      <template v-for="issue in visibleIssues" :key="issue.id">
        <span :title="issueTooltip(issue)" class="block font-semibold text-gray-600 dark:text-gray-300">
          <a
            v-if="safeExternalUrl(issue.jira_url)"
            :href="safeExternalUrl(issue.jira_url)"
            target="_blank"
            rel="noopener"
            class="text-blue-600 dark:text-blue-400 underline decoration-dotted underline-offset-2"
            @click.stop
          >{{ issue.bug_key }}</a>
          <span v-else class="border-b border-dotted border-gray-400 cursor-help">{{ issue.bug_key }}</span>
          <span> — {{ issueDescription(issue) }}</span>
        </span>
      </template>
    </template>
    <span
      v-else
      role="img"
      tabindex="0"
      :aria-label="neutralTooltip"
      :title="emptyTooltip"
      class="inline-block text-gray-500 dark:text-gray-400 border-b border-dotted border-gray-400 cursor-help"
    >{{ neutralMessage }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { safeExternalUrl } from '../utils/external-url'
import { isVisibleJiraIssue } from '../utils/product-bugs'

const props = defineProps({
  findings: { type: Array, default: () => [] },
  verdict: { type: String, default: '' },
  neutralMessage: { type: String, default: '—' },
  neutralTooltip: { type: String, default: 'No Jira-linked issue recorded.' }
})

const visibleIssues = computed(() => props.findings.filter(isVisibleJiraIssue))
const unsuccessful = computed(() => ['FAIL', 'ERROR'].includes(String(props.verdict).toUpperCase()))
const emptyTooltip = computed(() => unsuccessful.value
  ? 'The test failed or was terminated without a Jira-linked issue recorded.'
  : props.neutralTooltip)

function issueName(issue) {
  if (issue.category === 'UX_DEFECT') return 'UX defect'
  if (issue.category === 'PRODUCT_BUG') return 'product bug'
  if (issue.category === 'RFE') return 'RFE'
  if (issue.category === 'SPEC_DEFECT') return 'test specification defect'
  if (issue.category === 'AUTOMATION_BUG') return 'test automation defect'
  return 'Jira issue'
}

function issueDescription(issue) {
  const name = issueName(issue)
  if (issue.action === 'EXISTING' || issue.action === 'MATCH') return `Pre-existing ${name} detected.`
  if (issue.action === 'FILED' || issue.opened) return `New ${name} opened.`
  return `${name[0].toUpperCase()}${name.slice(1)} detected.`
}

function issueTooltip(issue) {
  if (issue.action === 'EXISTING' || issue.action === 'MATCH') return `The test encountered an already reported ${issueName(issue)}. No new issue was opened.`
  if (issue.action === 'FILED' || issue.opened) {
    return `A new ${issueName(issue)} was detected. ${issue.bug_key} has been opened.`
  }
  return `A ${issueName(issue)} was detected, but its issue-handling status is unavailable.`
}
</script>
