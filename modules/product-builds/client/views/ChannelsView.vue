<script setup>
import { ref, computed, onMounted, inject, watch } from 'vue'
import { Search } from 'lucide-vue-next'
import { useChannels } from '../composables/useChannels'
import {
  sortChannels,
  filterChannels,
  collectFilterOptions,
  stackLabel,
  osLabel,
  acceleratorMeta,
} from '../utils/channels'
import { formatShortDate } from '../utils/formatting'
import PersistentSearchBar from '../components/PersistentSearchBar.vue'
import ChannelMatrix from '../components/channels/ChannelMatrix.vue'
import ChannelDrawer from '../components/channels/ChannelDrawer.vue'
import ChannelName from '../components/channels/ChannelName.vue'
import MaturityBadge from '../components/channels/MaturityBadge.vue'

const nav = inject('moduleNav')
const { channels, source, asOf, loading, error, load } = useChannels()

const query = ref('')
const maturity = ref('')
const release = ref('')
const os = ref('')

const MATURITY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'stable', label: 'Stable' },
  { value: 'rolling', label: 'Rolling' },
]

const selectedName = computed(() => nav.params.value?.channel || null)

const sortedChannels = computed(() => sortChannels(channels.value))
const filterOptions = computed(() => collectFilterOptions(channels.value))
const visibleChannels = computed(() => filterChannels(sortedChannels.value, {
  query: query.value,
  maturity: maturity.value,
  release: release.value,
  os: os.value,
}))
const visibleNames = computed(() => new Set(visibleChannels.value.map(c => c.name)))
const hasFilters = computed(() => !!(query.value || maturity.value || release.value || os.value))

const counts = computed(() => {
  const stable = channels.value.filter(c => c.maturity === 'stable').length
  return { stable, rolling: channels.value.length - stable }
})

// Drop filter values that no longer exist after a reload.
watch(filterOptions, (opts) => {
  if (release.value && !opts.releases.includes(release.value)) release.value = ''
  if (os.value && !opts.osVersions.includes(os.value)) os.value = ''
})

onMounted(() => load())

function openChannel(name) {
  nav.updateParams({ channel: name }, { push: false })
}

function closeChannel() {
  nav.updateParams({ channel: undefined }, { push: false })
}

function clearFilters() {
  query.value = ''
  maturity.value = ''
  release.value = ''
  os.value = ''
}

function viewBaseImages() {
  nav.navigateTo('base-images')
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="max-w-2xl">
        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Channels</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Find the package channel that matches your accelerator, torch and OS.
          Stable channels are adopted by a product release; rolling channels pick up new content continuously.
        </p>
      </div>
      <PersistentSearchBar />
    </div>

    <p
      v-if="source === 'sample'"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
      data-testid="channels-sample-note"
    >
      Sample data<template v-if="asOf"> as of {{ formatShortDate(asOf) }}</template>: channels are not published by the dashboard API yet,
      so this page shows a representative catalog. Index URLs and image pull specs are illustrative.
    </p>

    <!-- Loading -->
    <div v-if="loading" class="space-y-4" aria-live="polite">
      <div class="h-80 rounded-xl border border-gray-100 bg-white p-5 animate-pulse dark:border-gray-700/60 dark:bg-gray-800">
        <div class="mb-4 h-4 w-48 rounded bg-gray-200 dark:bg-gray-700"></div>
        <div class="h-56 rounded bg-gray-100 dark:bg-gray-700/60"></div>
      </div>
    </div>

    <!-- Error -->
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

    <template v-else>
      <!-- Matrix -->
      <section class="rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">Accelerator and torch coverage</h2>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Rows are accelerator stacks, columns are torch versions. Pick a channel to see its RHAIBI drops and wheels.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400" aria-label="Legend">
            <span class="inline-flex items-center gap-1.5">
              <span class="h-3.5 w-5 rounded border border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/30" aria-hidden="true"></span>
              Stable <span class="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{{ counts.stable }}</span>
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="h-3.5 w-5 rounded border border-dashed border-amber-400 dark:border-amber-600" aria-hidden="true"></span>
              Rolling <span class="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{{ counts.rolling }}</span>
            </span>
          </div>
        </div>

        <!-- Filters -->
        <div class="mt-4 flex flex-wrap items-center gap-2">
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
          <div class="inline-flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-600" role="group" aria-label="Maturity">
            <button
              v-for="opt in MATURITY_OPTIONS"
              :key="opt.value"
              type="button"
              class="rounded-md px-2.5 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              :class="maturity === opt.value
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'"
              :aria-pressed="maturity === opt.value"
              @click="maturity = opt.value"
            >{{ opt.label }}</button>
          </div>
          <select
            v-model="release"
            aria-label="Compatible release"
            class="rounded-lg border border-gray-300 bg-white py-1.5 pl-2.5 pr-8 text-sm text-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">Any release</option>
            <option v-for="r in filterOptions.releases" :key="r" :value="r">{{ r }}</option>
          </select>
          <select
            v-model="os"
            aria-label="Operating system"
            class="rounded-lg border border-gray-300 bg-white py-1.5 pl-2.5 pr-8 text-sm text-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">Any OS</option>
            <option v-for="o in filterOptions.osVersions" :key="o" :value="o">{{ osLabel(o) }}</option>
          </select>
          <span v-if="hasFilters" class="text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
            {{ visibleChannels.length }} of {{ channels.length }} match
            <button type="button" class="ml-1 font-medium text-primary-700 hover:underline dark:text-blue-400" @click="clearFilters">Clear filters</button>
          </span>
        </div>

        <div class="mt-4">
          <ChannelMatrix
            :channels="channels"
            :visible-names="visibleNames"
            :selected-name="selectedName"
            @select="openChannel"
          />
        </div>
      </section>

      <!-- Channel list -->
      <section class="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
        <div class="px-5 pt-5 pb-3">
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">All channels</h2>
        </div>
        <div v-if="visibleChannels.length" class="overflow-x-auto">
          <table class="w-full text-sm" data-testid="channels-table">
            <thead>
              <tr class="border-y border-gray-100 bg-gray-50 text-left text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                <th scope="col" class="px-5 py-2 font-medium">Channel</th>
                <th scope="col" class="px-3 py-2 font-medium">Maturity</th>
                <th scope="col" class="px-3 py-2 font-medium">Accelerator</th>
                <th scope="col" class="px-3 py-2 font-medium">Torch</th>
                <th scope="col" class="px-3 py-2 font-medium">OS</th>
                <th scope="col" class="px-3 py-2 font-medium">Compatible releases</th>
                <th scope="col" class="px-3 py-2 font-medium">Latest RHAIBI drop</th>
                <th scope="col" class="px-5 py-2 font-medium text-right">Wheels</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700/60">
              <tr
                v-for="channel in visibleChannels"
                :key="channel.name"
                class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40"
                :class="channel.name === selectedName ? 'bg-primary-50/60 dark:bg-blue-900/20' : ''"
                data-testid="channel-row"
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
                <td class="px-3 py-2.5"><MaturityBadge :maturity="channel.maturity" /></td>
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
          No channels match these filters.
          <button type="button" class="ml-1 font-medium text-primary-700 hover:underline dark:text-blue-400" @click="clearFilters">Clear filters</button>
        </div>
      </section>
    </template>

    <ChannelDrawer :name="selectedName" :sample="source === 'sample'" @close="closeChannel" @view-base-images="viewBaseImages" />
  </div>
</template>
