<script setup>
defineProps({
  feature: { type: Object, required: true },
  index: { type: Number, default: null },
  jiraBaseUrl: { type: String, default: 'https://issues.redhat.com/browse' }
})

var emit = defineEmits(['select'])

function placementClass(event) {
  if (event === 'Descope') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
  if (event === 'Below cut') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
  if (event === 'EA1' || event === 'EA2' || event === 'GA') {
    return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'
  }
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
}

function readyClass(ready) {
  if (ready === 'Plan-ready') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
  if (ready === 'Partial') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
}
</script>

<template>
  <tr
    role="row"
    class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
    :class="{
      'bg-emerald-50/80 dark:bg-emerald-900/20': feature.approved,
      'opacity-70': feature.frozen
    }"
    @click="emit('select', feature)"
  >
    <td class="px-2 py-2.5 text-center text-xs tabular-nums text-gray-400 dark:text-gray-600 select-none w-8">
      {{ index != null ? index : '' }}
    </td>
    <td class="px-3 py-2.5 whitespace-nowrap">
      <a
        :href="jiraBaseUrl + '/' + feature.key"
        target="_blank"
        rel="noopener noreferrer"
        class="font-mono text-xs font-semibold text-primary-600 dark:text-blue-400 hover:underline"
        @click.stop
      >{{ feature.key }}</a>
    </td>
    <td class="px-3 py-2.5 max-w-[20rem]">
      <span class="text-xs text-gray-900 dark:text-gray-100 line-clamp-2" :title="feature.summary">{{ feature.summary }}</span>
    </td>
    <td class="px-3 py-2.5 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
      {{ feature.basePlacement }}
    </td>
    <td class="px-3 py-2.5 whitespace-nowrap">
      <span
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
        :class="placementClass(feature.event)"
      >{{ feature.event }}</span>
      <span v-if="feature.changed" class="ml-1 text-[10px] text-amber-600 dark:text-amber-400">edited</span>
    </td>
    <td class="px-3 py-2.5 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">
      {{ feature.productFamily || '—' }}
    </td>
    <td class="px-3 py-2.5 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">
      {{ feature.component || '—' }}
    </td>
    <td class="px-3 py-2.5 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">
      {{ feature.assignee || '—' }}
    </td>
    <td class="px-3 py-2.5 whitespace-nowrap">
      <span
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
        :class="readyClass(feature.ready)"
      >{{ feature.ready || '—' }}</span>
    </td>
    <td class="px-3 py-2.5 text-center">
      <span v-if="feature.approved" class="text-green-600 dark:text-green-400 text-xs font-semibold">Yes</span>
      <span v-else class="text-gray-300 dark:text-gray-600 text-xs">—</span>
    </td>
    <td class="px-3 py-2.5 text-center">
      <span v-if="feature.frozen" class="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 font-semibold">Frozen</span>
      <span v-else class="text-gray-300 dark:text-gray-600 text-xs">—</span>
    </td>
  </tr>
</template>
