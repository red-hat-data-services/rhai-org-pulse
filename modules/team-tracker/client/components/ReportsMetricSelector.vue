<template>
  <div>
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">Metrics</h3>
    <div class="space-y-1">
      <label
        v-for="metric in metrics"
        :key="metric.key"
        class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
      >
        <input
          type="checkbox"
          :value="metric.key"
          :checked="modelValue.includes(metric.key)"
          @change="toggle(metric.key)"
          class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
        />
        <span class="text-sm text-gray-700 dark:text-gray-300">{{ metric.label }}</span>
      </label>
    </div>
  </div>
</template>

<script setup>
const metrics = [
  { key: 'teamSize', label: 'Team Size' },
  { key: 'resolvedCount', label: 'Issues Resolved (90d)' },
  { key: 'avgCycleTime', label: 'Avg Cycle Time' },
  { key: 'resolvedPerMember', label: 'Issues Resolved per Member (90d)' },
  { key: 'githubContributions', label: 'GitHub Contributions (1yr)' },
  { key: 'githubPerMember', label: 'Avg GitHub Contributions per Member (1yr)' },
  { key: 'gitlabContributions', label: 'GitLab Contributions (1yr)' },
  { key: 'gitlabPerMember', label: 'Avg GitLab Contributions per Member (1yr)' }
]

const props = defineProps({
  modelValue: { type: Array, required: true }
})
const emit = defineEmits(['update:modelValue'])

function toggle(key) {
  const current = [...props.modelValue]
  const idx = current.indexOf(key)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(key)
  }
  emit('update:modelValue', current)
}
</script>
