<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-vue-next'
import { useChannels } from '../../composables/useChannels'
import {
  sortChannels,
  filterChannels,
  stackLabel,
  osLabel,
  acceleratorMeta,
} from '../../utils/channels'
import { formatShortDate } from '../../utils/formatting'
import ChannelName from './ChannelName.vue'

const nav = inject('moduleNav')

const { channels, source, asOf, loading, error, load } = useChannels()

const query = ref('')
const sortField = ref('')
const sortDirection = ref('asc')

const TABLE_COLUMNS = [
  { field: 'name', label: 'Channel' },
  { field: 'accelerator', label: 'Accelerator' },
  { field: 'torch_version', label: 'Torch' },
  { field: 'rhel_version', label: 'OS' },
  { field: 'compatible_releases', label: 'Compatible releases' },
  { field: 'latest_drop', label: 'Latest RHAIBI drop' },
  { field: 'wheel_count', label: 'Wheels' },
]

const sortedChannels = computed(() => sortChannels(channels.value, {
  field: sortField.value,
  direction: sortDirection.value,
}))
const visibleChannels = computed(() => filterChannels(sortedChannels.value, { query: query.value }))

onMounted(() => load())

function toggleSort(field) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDirection.value = 'asc'
  }
}

function openChannel(name) {
  nav.navigateTo('channel-detail', { channel: name, product: 'base-images' })
}
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-gray-500 dark:text-gray-400">
      Find the package channel that matches your accelerator, torch and OS.
      Pick a channel to see its RHAIBI drops and wheels.
    </p>

    <p
      v-if="source === 'sample'"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
      data-testid="base-images-channels-sample-note"
    >
      Sample data<template v-if="asOf"> as of {{ formatShortDate(asOf) }}</template>: this page shows a representative demo catalog.
      Index URLs and image pull specs are illustrative.
    </p>
    <p v-else-if="source === 'dashboard'" class="text-sm text-gray-500 dark:text-gray-400" data-testid="base-images-channels-source-note">
      Dashboard data<template v-if="asOf"> · Catalog updated {{ formatShortDate(asOf) }}</template>
    </p>

    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400" aria-live="polite">Loading channels…</div>

    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <p class="text-sm text-red-700 dark:text-red-300">Could not load channels: {{ error }}</p>
      <button type="button" class="mt-2 text-sm font-medium text-red-700 underline dark:text-red-300" @click="load()">Try again</button>
    </div>

    <div
      v-else-if="!channels.length"
      class="rounded-xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700/60 dark:bg-gray-800 dark:text-gray-400"
    >
      No channels are published yet.
    </div>

    <section v-else class="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800" data-testid="base-images-channels">
      <div class="flex flex-wrap items-center gap-2 px-5 pt-5 pb-3">
        <div class="relative w-full sm:w-64">
          <Search :size="14" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            v-model="query"
            type="search"
            placeholder="Search channels, e.g. cuda13.0"
            aria-label="Search channels"
            class="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
          />
        </div>
        <span class="text-xs text-gray-500 dark:text-gray-400" role="status">
          {{ visibleChannels.length }} of {{ channels.length }} channels
        </span>
      </div>

      <div v-if="visibleChannels.length" class="overflow-x-auto">
        <table class="w-full text-sm" data-testid="base-images-channels-table">
          <thead>
            <tr class="border-y border-gray-100 bg-gray-50 text-left text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
              <th
                v-for="col in TABLE_COLUMNS"
                :key="col.field"
                scope="col"
                class="py-2 font-medium"
                :class="col.field === 'name' || col.field === 'wheel_count' ? 'px-5' : 'px-3'"
                :aria-sort="sortField === col.field ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined"
              >
                <button
                  type="button"
                  class="flex w-full items-center gap-1 rounded text-left hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  :class="[
                    col.field === 'wheel_count' ? 'justify-end' : '',
                    sortField === col.field ? 'text-primary-700 dark:text-blue-400' : '',
                  ]"
                  :aria-label="`Sort by ${col.label}`"
                  @click="toggleSort(col.field)"
                >
                  {{ col.label }}
                  <component
                    :is="sortField === col.field ? (sortDirection === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown"
                    :size="12"
                    class="shrink-0"
                    aria-hidden="true"
                  />
                </button>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700/60">
            <tr
              v-for="channel in visibleChannels"
              :key="channel.name"
              class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40"
              data-testid="base-images-channel-row"
              @click="openChannel(channel.name)"
            >
              <td class="px-5 py-2.5">
                <button
                  type="button"
                  class="rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  @click.stop="openChannel(channel.name)"
                >
                  <ChannelName :channel="channel" />
                </button>
              </td>
              <td class="px-3 py-2.5 whitespace-nowrap">
                <span class="inline-flex items-center gap-1.5">
                  <span class="h-2.5 w-1 rounded-full" :class="acceleratorMeta(channel.accelerator).rule" aria-hidden="true"></span>
                  <span class="text-gray-900 dark:text-gray-100">{{ stackLabel(channel) }}</span>
                </span>
              </td>
              <td class="px-3 py-2.5 tabular-nums whitespace-nowrap" :class="channel.torch_version ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'">
                {{ channel.torch_version || 'None' }}
              </td>
              <td class="px-3 py-2.5 whitespace-nowrap text-gray-700 dark:text-gray-300">{{ osLabel(channel.rhel_version) }}</td>
              <td class="px-3 py-2.5">
                <span v-if="channel.compatible_releases?.length" class="text-gray-700 dark:text-gray-300">{{ channel.compatible_releases.join(', ') }}</span>
                <span v-else class="text-gray-400 dark:text-gray-500">None yet</span>
              </td>
              <td class="px-3 py-2.5 whitespace-nowrap">
                <template v-if="channel.latest_drop">
                  <span class="text-gray-900 dark:text-gray-100">{{ channel.latest_drop.name }}</span>
                  <span class="ml-1.5 text-xs text-gray-500 dark:text-gray-400">{{ formatShortDate(channel.latest_drop.created_at) }}</span>
                </template>
                <span v-else class="text-gray-400 dark:text-gray-500">None yet</span>
              </td>
              <td class="px-5 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{{ channel.wheel_count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="px-5 pb-6 text-sm text-gray-500 dark:text-gray-400">
        No channels match this search.
        <button type="button" class="ml-1 font-medium text-primary-700 hover:underline dark:text-blue-400" @click="query = ''">Clear search</button>
      </div>
    </section>
  </div>
</template>
