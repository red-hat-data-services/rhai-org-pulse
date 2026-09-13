<script setup>
import { computed } from 'vue'
import { ShieldCheck, RefreshCw } from 'lucide-vue-next'
import { buildChannelMatrix, acceleratorMeta, osLabel, releaseSummary } from '../../utils/channels'

const props = defineProps({
  channels: { type: Array, required: true },
  visibleNames: { type: Set, required: true },
  selectedName: { type: String, default: null },
})

const emit = defineEmits(['select'])

const matrix = computed(() => buildChannelMatrix(props.channels))
const multiOs = computed(() => new Set(props.channels.map(c => c.rhel_version)).size > 1)

function cellClass(channel) {
  const base = channel.maturity === 'stable'
    ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-700 dark:hover:bg-emerald-900/40'
    : 'bg-white border-dashed border-amber-400 hover:bg-amber-50 dark:bg-gray-800 dark:border-amber-600 dark:hover:bg-amber-900/20'
  const selected = channel.name === props.selectedName
    ? ' ring-2 ring-primary-500 dark:ring-blue-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-800'
    : ''
  const dimmed = props.visibleNames.has(channel.name) ? '' : ' opacity-30'
  return base + selected + dimmed
}
</script>

<template>
  <div class="overflow-x-auto -mx-5 px-5 pb-1">
    <table class="border-separate border-spacing-1.5 -ml-1.5" data-testid="channel-matrix">
      <thead>
        <tr>
          <th scope="col" class="sticky left-0 z-10 bg-white dark:bg-gray-800 text-left align-bottom pr-3 pb-1 text-xs font-normal text-gray-500 dark:text-gray-400 min-w-[6.5rem]">
            Accelerator
          </th>
          <th
            v-for="(col, i) in matrix.columns"
            :key="col.id"
            scope="col"
            class="text-left align-bottom pb-1 px-1 font-normal min-w-[7.5rem]"
          >
            <span v-if="i === 0 && col.id !== 'notorch'" class="block text-xs text-gray-500 dark:text-gray-400">Torch</span>
            <span
              class="text-base tabular-nums"
              :class="col.id === 'notorch' ? 'text-gray-500 dark:text-gray-400' : 'font-semibold text-gray-900 dark:text-gray-100'"
            >{{ col.label }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in matrix.rows" :key="row.id">
          <th scope="row" class="sticky left-0 z-10 bg-white dark:bg-gray-800 text-left pr-3 font-normal">
            <span class="flex items-center gap-2">
              <span class="w-1 self-stretch min-h-[2.25rem] rounded-full" :class="acceleratorMeta(row.accelerator).rule" aria-hidden="true"></span>
              <span class="whitespace-nowrap">
                <span class="font-semibold text-gray-900 dark:text-gray-100">{{ acceleratorMeta(row.accelerator).label }}</span>
                <span v-if="row.accelerator_version" class="ml-1 tabular-nums text-gray-500 dark:text-gray-400">{{ row.accelerator_version }}</span>
              </span>
            </span>
          </th>
          <td v-for="col in matrix.columns" :key="col.id" class="align-top p-0">
            <div v-if="row.cells[col.id]" class="flex flex-col gap-1">
              <button
                v-for="channel in row.cells[col.id]"
                :key="channel.name"
                type="button"
                class="w-full text-left rounded-lg border px-2.5 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                :class="cellClass(channel)"
                :aria-label="`Open channel ${channel.name}`"
                :aria-pressed="channel.name === selectedName"
                :data-channel="channel.name"
                @click="emit('select', channel.name)"
              >
                <span
                  class="flex items-center gap-1 text-xs font-medium"
                  :class="channel.maturity === 'stable' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'"
                >
                  <ShieldCheck v-if="channel.maturity === 'stable'" :size="12" aria-hidden="true" />
                  <RefreshCw v-else :size="12" aria-hidden="true" />
                  {{ channel.maturity === 'stable' ? 'Stable' : 'Rolling' }}
                  <span v-if="multiOs" class="ml-auto font-normal text-gray-500 dark:text-gray-400">{{ osLabel(channel.rhel_version) }}</span>
                </span>
                <span class="block mt-0.5 text-[11px] leading-tight text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {{ releaseSummary(channel.compatible_releases) }}
                </span>
              </button>
            </div>
            <div v-else class="h-full min-h-[2.75rem] rounded-lg bg-gray-50 dark:bg-gray-900/40" aria-hidden="true"></div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
