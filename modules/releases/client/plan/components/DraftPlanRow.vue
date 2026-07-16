<script setup>
defineProps({
  feature: { type: Object, required: true },
  index: { type: Number, default: null },
  jiraBaseUrl: { type: String, default: 'https://issues.redhat.com/browse' },
  placements: { type: Array, required: true }
})

var emit = defineEmits(['select', 'move', 'descope', 'undescope', 'approve'])

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

function onMoveChange(feature, event) {
  var placement = event.target.value
  if (!placement) return
  emit('move', feature.key, placement)
}
</script>

<template>
  <tr
    role="row"
    class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
    :class="{
      'bg-emerald-50/80 dark:bg-emerald-900/20': feature.approved,
      'opacity-70': feature.frozen
    }"
  >
    <td
      class="px-2 py-2.5 text-center text-xs tabular-nums text-gray-400 dark:text-gray-600 select-none w-8 cursor-pointer"
      @click="emit('select', feature)"
    >
      {{ index != null ? index : '' }}
    </td>
    <td class="px-3 py-2.5 whitespace-nowrap cursor-pointer" @click="emit('select', feature)">
      <a
        :href="jiraBaseUrl + '/' + feature.key"
        target="_blank"
        rel="noopener noreferrer"
        class="font-mono text-xs font-semibold text-primary-600 dark:text-blue-400 hover:underline"
        @click.stop
      >{{ feature.key }}</a>
    </td>
    <td class="px-3 py-2.5 max-w-[16rem] cursor-pointer" @click="emit('select', feature)">
      <span class="text-xs text-gray-900 dark:text-gray-100 line-clamp-2" :title="feature.summary">{{ feature.summary }}</span>
    </td>
    <td class="px-3 py-2.5 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 cursor-pointer" @click="emit('select', feature)">
      {{ feature.basePlacement }}
    </td>
    <td class="px-3 py-2.5 whitespace-nowrap cursor-pointer" @click="emit('select', feature)">
      <span
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
        :class="placementClass(feature.event)"
      >{{ feature.event }}</span>
    </td>
    <td class="px-2 py-2.5 whitespace-nowrap" @click.stop>
      <select
        class="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs px-1 py-0.5 max-w-[7.5rem] disabled:opacity-50"
        :disabled="!feature.editable || feature.decision === 'descope'"
        :value="feature.decision === 'descope' ? '' : (feature.event === 'Descope' ? '' : feature.event)"
        :aria-label="'Move ' + feature.key"
        @change="onMoveChange(feature, $event)"
      >
        <option disabled value="">Move…</option>
        <option v-for="p in placements" :key="p" :value="p">{{ p }}</option>
      </select>
    </td>
    <td class="px-2 py-2.5 whitespace-nowrap" @click.stop>
      <button
        v-if="feature.decision !== 'descope'"
        type="button"
        class="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-40"
        :disabled="!feature.editable"
        @click="emit('descope', feature.key)"
      >Descope</button>
      <button
        v-else
        type="button"
        class="text-xs text-gray-600 dark:text-gray-300 hover:underline disabled:opacity-40"
        :disabled="!feature.editable"
        @click="emit('undescope', feature.key)"
      >Undo</button>
    </td>
    <td class="px-2 py-2.5 text-center" @click.stop>
      <input
        type="checkbox"
        :checked="feature.approved"
        :disabled="!feature.editable || feature.decision === 'descope'"
        :aria-label="'Approve ' + feature.key"
        @change="emit('approve', feature.key, $event.target.checked)"
      />
    </td>
    <td class="px-3 py-2.5 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 cursor-pointer" @click="emit('select', feature)">
      {{ feature.productFamily || '—' }}
    </td>
    <td class="px-3 py-2.5 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 cursor-pointer" @click="emit('select', feature)">
      {{ feature.component || '—' }}
    </td>
    <td class="px-3 py-2.5 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 cursor-pointer" @click="emit('select', feature)">
      {{ feature.assignee || '—' }}
    </td>
    <td class="px-3 py-2.5 whitespace-nowrap cursor-pointer" @click="emit('select', feature)">
      <span
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
        :class="readyClass(feature.ready)"
      >{{ feature.ready || '—' }}</span>
    </td>
    <td class="px-3 py-2.5 text-center cursor-pointer" @click="emit('select', feature)">
      <span v-if="feature.frozen" class="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 font-semibold">Frozen</span>
      <span v-else class="text-gray-300 dark:text-gray-600 text-xs">—</span>
    </td>
  </tr>
</template>
