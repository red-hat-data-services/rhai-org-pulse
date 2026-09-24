<script setup>
import TvFvDeltaView from '../../views/TvFvDeltaView.vue'

var props = defineProps({
  /**
   * Jira version names to sync onto the embedded report's release picker
   * (e.g. PM Hub's resolved version filter). Passed straight through to
   * TvFvDeltaView — see that component for sync semantics.
   */
  syncedVersions: { type: Array, default: null },
  collapsed: { type: Boolean, default: true }
})

var emit = defineEmits(['update:collapsed'])

function toggle() {
  emit('update:collapsed', !props.collapsed)
}
</script>

<template>
  <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden" data-testid="tv-fv-delta-panel">
    <!-- Toggle header -->
    <button
      type="button"
      class="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors"
      @click="toggle"
    >
      <div class="flex items-center gap-2">
        <svg
          class="w-4 h-4 text-gray-400 transition-transform"
          :class="{ '-rotate-90': collapsed }"
          fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
        <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">TV vs FV Delta</span>
      </div>
      <span class="text-xs text-gray-400 dark:text-gray-500">Target vs Fix Version alignment — full report</span>
    </button>

    <!-- Collapsible body: full, unmodified TV vs FV Delta report -->
    <div v-if="!collapsed" class="border-t border-gray-200 dark:border-gray-700">
      <TvFvDeltaView :synced-versions="syncedVersions" />
    </div>
  </div>
</template>
