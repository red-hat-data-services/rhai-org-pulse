<template>
  <div>
    <ul class="divide-y divide-gray-100 dark:divide-gray-700">
      <li
        v-for="comp in components"
        :key="comp"
        class="flex items-center justify-between py-2"
      >
        <span class="text-sm text-gray-800 dark:text-gray-200">{{ comp }}</span>
        <a
          v-if="rfeCounts[comp]"
          :href="buildRfeUrl(comp)"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/30 transition-colors"
        >
          {{ rfeCounts[comp] }} RFEs
          <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </li>
    </ul>
    <div v-if="components.length === 0" class="text-sm text-gray-500 dark:text-gray-400 py-2">
      No components assigned.
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  components: { type: Array, required: true },
  rfeCounts: { type: Object, default: () => ({}) },
  rfeConfig: { type: Object, default: () => ({}) }
})

function buildRfeUrl(component) {
  const config = props.rfeConfig
  const host = config.jiraHost || 'https://redhat.atlassian.net'
  const project = config.jiraProject || 'RHAIRFE'
  const issueType = config.rfeIssueType || 'Feature Request'
  const mapping = config.componentMapping || {}
  const jiraComp = mapping[component] || component
  const jql = `project = ${project} AND component = "${jiraComp}" AND issuetype = "${issueType}" AND statusCategory != "Done"`
  return `${host}/issues/?jql=${encodeURIComponent(jql)}`
}
</script>
