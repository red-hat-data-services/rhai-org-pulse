<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { Copy, Check, Search } from 'lucide-vue-next'
import { WHEEL_KINDS, filterWheels, stackLabel, osLabel } from '../../utils/channels'
import { formatShortDate, archBadgeClass, getRegistryUrl } from '../../utils/formatting'

const props = defineProps({
  channel: { type: Object, required: true },
  // Sample catalogs carry made-up index URLs and pull specs, so copy actions are hidden.
  sample: { type: Boolean, default: false },
  showViewAllBaseImages: { type: Boolean, default: true },
})

const emit = defineEmits(['view-base-images', 'view-drop'])

const activeTab = ref('drops')
const wheelQuery = ref('')
const wheelKind = ref('')
const copied = ref(null)
let copiedTimer = null

const wheels = computed(() => props.channel?.wheels || [])

const visibleWheels = computed(() =>
  filterWheels(wheels.value, { query: wheelQuery.value, kind: wheelKind.value })
)

// wheel_kinds is derived data an upstream source may not provide.
const kindSegments = computed(() => {
  const counts = props.channel?.wheel_kinds
  const total = props.channel?.wheel_count || 0
  if (!counts || !total) return []
  return Object.entries(WHEEL_KINDS).map(([kind, meta]) => ({
    kind,
    ...meta,
    count: counts[kind] || 0,
    percent: total ? ((counts[kind] || 0) / total) * 100 : 0,
  }))
})

const releases = computed(() => props.channel?.compatible_releases || [])
const drops = computed(() => props.channel?.drops || [])

const hasWheelFilter = computed(() => !!wheelQuery.value)

function toggleKind(kind) {
  wheelKind.value = wheelKind.value === kind ? '' : kind
}

function clearWheelFilter() {
  wheelQuery.value = ''
}

async function copy(text, key) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = key
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copied.value = null }, 1500)
  } catch { /* clipboard unavailable */ }
}

onBeforeUnmount(() => clearTimeout(copiedTimer))

defineExpose({ hasWheelFilter, clearWheelFilter })
</script>

<template>
  <div>
    <!-- Facts -->
    <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
      <div>
        <dt class="text-xs text-gray-500 dark:text-gray-400">Accelerator</dt>
        <dd class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ stackLabel(channel) }}</dd>
      </div>
      <div>
        <dt class="text-xs text-gray-500 dark:text-gray-400">Torch</dt>
        <dd class="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">{{ channel.torch_version || 'Not included' }}</dd>
      </div>
      <div>
        <dt class="text-xs text-gray-500 dark:text-gray-400">OS</dt>
        <dd class="text-sm font-medium text-gray-900 dark:text-gray-100">
          {{ osLabel(channel.rhel_version) }}
          <span v-if="channel.os_release" class="font-normal text-gray-500 dark:text-gray-400">({{ channel.os_release }})</span>
        </dd>
      </div>
      <div>
        <dt class="text-xs text-gray-500 dark:text-gray-400">Python</dt>
        <dd class="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">{{ channel.python_version }}</dd>
      </div>
      <div class="col-span-2">
        <dt class="text-xs text-gray-500 dark:text-gray-400">Architectures</dt>
        <dd class="mt-0.5 flex flex-wrap gap-1">
          <span
            v-for="arch in channel.architectures || []"
            :key="arch"
            class="rounded px-1.5 py-0.5 text-xs font-medium"
            :class="archBadgeClass(arch)"
          >{{ arch }}</span>
        </dd>
      </div>
    </dl>

    <div class="mt-5">
      <h3 v-if="releases.length" class="text-xs text-gray-500 dark:text-gray-400">Compatible releases</h3>
      <div v-if="releases.length" class="mt-1 flex flex-wrap gap-1.5">
        <span
          v-for="release in releases"
          :key="release"
          class="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >{{ release }}</span>
      </div>
    </div>

    <!-- Index URL -->
    <div class="mt-5">
      <h3 class="text-xs text-gray-500 dark:text-gray-400">
        Package index
        <span v-if="channel.visibility === 'private'">(requires Red Hat customer portal credentials)</span>
      </h3>
      <div class="mt-1 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
        <code class="min-w-0 flex-1 truncate text-xs text-gray-800 dark:text-gray-200" :title="channel.index_url">{{ channel.index_url }}</code>
        <button
          v-if="!sample"
          type="button"
          class="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50 dark:text-blue-400 dark:hover:bg-gray-700"
          @click="copy(channel.index_url, 'index')"
        >
          <Check v-if="copied === 'index'" :size="14" aria-hidden="true" />
          <Copy v-else :size="14" aria-hidden="true" />
          {{ copied === 'index' ? 'Copied' : 'Copy' }}
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="mt-6 border-b border-gray-200 dark:border-gray-700" role="tablist" aria-label="Channel content">
      <button
        v-for="tab in [
          { id: 'drops', label: 'RHAIBI drops', count: drops.length },
          { id: 'wheels', label: 'Wheels', count: wheels.length },
        ]"
        :id="`channel-tab-${tab.id}`"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.id"
        :aria-controls="`channel-panel-${tab.id}`"
        class="-mb-px mr-5 inline-flex items-center gap-1.5 border-b-2 pb-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        :class="activeTab === tab.id
          ? 'border-primary-600 text-primary-700 dark:border-blue-400 dark:text-blue-400'
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
        <span class="rounded-full bg-gray-100 px-1.5 text-xs tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-400">{{ tab.count }}</span>
      </button>
    </div>

    <!-- Drops -->
    <div v-if="activeTab === 'drops'" id="channel-panel-drops" role="tabpanel" aria-labelledby="channel-tab-drops" class="pt-4">
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>
          Images published to
          <a :href="getRegistryUrl(channel.base_image)" target="_blank" rel="noopener noreferrer" class="hover:underline">
            <code class="text-gray-700 dark:text-gray-300">{{ channel.base_image }}</code>
          </a>
        </span>
        <button
          v-if="showViewAllBaseImages"
          type="button"
          class="font-medium text-primary-700 hover:underline dark:text-blue-400"
          @click="emit('view-base-images')"
        >View all base image builds</button>
      </div>

      <p v-if="!drops.length" class="mt-4 text-sm text-gray-500 dark:text-gray-400">
        No RHAIBI drop includes this channel yet.
      </p>
      <ol v-else class="mt-4 space-y-0">
        <li
          v-for="(drop, i) in drops"
          :key="drop.name"
          class="relative pl-6 pb-4"
          data-testid="channel-drop"
        >
          <span
            v-if="i < drops.length - 1"
            class="absolute left-[5px] top-3 bottom-0 w-px bg-gray-200 dark:bg-gray-700"
            aria-hidden="true"
          ></span>
          <span
            class="absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2"
            :class="i === 0 ? 'border-primary-600 bg-primary-600 dark:border-blue-400 dark:bg-blue-400' : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900'"
            aria-hidden="true"
          ></span>
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <button
              type="button"
              class="rounded text-left text-sm font-medium text-primary-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-blue-400"
              :aria-label="`View drop ${drop.name}`"
              @click="emit('view-drop', drop)"
            >{{ drop.name }}</button>
            <span v-if="i === 0" class="rounded bg-primary-50 px-1.5 text-xs font-medium text-primary-700 dark:bg-blue-900/30 dark:text-blue-300">Latest</span>
            <span
              class="rounded px-1.5 text-xs"
              :class="drop.git_branch === 'main'
                ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'"
            >{{ drop.git_branch === 'main' ? 'main' : `${drop.git_branch} branch` }}</span>
            <time class="ml-auto text-xs text-gray-500 dark:text-gray-400" :datetime="drop.created_at">{{ formatShortDate(drop.created_at) }}</time>
          </div>
          <div class="mt-1 flex items-center gap-1">
            <code class="min-w-0 truncate text-xs text-gray-600 dark:text-gray-400" :title="drop.pullspec">{{ drop.pullspec }}</code>
            <button
              v-if="!sample"
              type="button"
              class="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              :aria-label="`Copy pull spec for ${drop.name}`"
              @click="copy(drop.pullspec, drop.name)"
            >
              <Check v-if="copied === drop.name" :size="12" />
              <Copy v-else :size="12" />
            </button>
          </div>
          <ul v-if="drop.changes?.length" class="mt-1.5 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
            <li v-for="change in drop.changes" :key="change">{{ change }}</li>
          </ul>
        </li>
      </ol>
    </div>

    <!-- Wheels -->
    <div v-else id="channel-panel-wheels" role="tabpanel" aria-labelledby="channel-tab-wheels" class="pt-4">
      <div v-if="kindSegments.length" class="flex h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden="true">
        <div
          v-for="seg in kindSegments"
          :key="seg.kind"
          :class="seg.bar"
          :style="{ width: `${seg.percent}%` }"
        ></div>
      </div>
      <div v-if="kindSegments.length" class="mt-2 flex flex-wrap gap-1.5">
        <button
          v-for="seg in kindSegments"
          :key="seg.kind"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
          :class="wheelKind === seg.kind
            ? 'border-primary-500 bg-primary-50 text-primary-800 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-200'
            : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'"
          :aria-pressed="wheelKind === seg.kind"
          :title="seg.hint"
          @click="toggleKind(seg.kind)"
        >
          <span class="h-2 w-2 rounded-full" :class="seg.bar" aria-hidden="true"></span>
          {{ seg.label }}
          <span class="tabular-nums font-medium">{{ seg.count }}</span>
        </button>
      </div>

      <div class="relative mt-3">
        <Search :size="14" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          v-model="wheelQuery"
          type="search"
          placeholder="Filter wheels by name"
          aria-label="Filter wheels by name"
          class="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
        />
      </div>

      <table v-if="visibleWheels.length" class="mt-3 w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <th scope="col" class="py-1.5 font-normal">Package</th>
            <th scope="col" class="py-1.5 font-normal">Version</th>
            <th v-if="kindSegments.length" scope="col" class="py-1.5 font-normal hidden sm:table-cell">Build</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr v-for="wheel in visibleWheels" :key="wheel.name" data-testid="channel-wheel">
            <td class="py-1.5 pr-3 font-medium text-gray-900 dark:text-gray-100">{{ wheel.name }}</td>
            <td class="py-1.5 pr-3 tabular-nums text-gray-700 dark:text-gray-300">{{ wheel.version }}</td>
            <td v-if="kindSegments.length" class="py-1.5 hidden sm:table-cell text-xs text-gray-500 dark:text-gray-400">{{ WHEEL_KINDS[wheel.kind]?.label || wheel.kind }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        No wheels match your filter.
        <button type="button" class="ml-1 font-medium text-primary-700 hover:underline dark:text-blue-400" @click="wheelQuery = ''; wheelKind = ''">Clear filter</button>
      </div>
    </div>
  </div>
</template>
