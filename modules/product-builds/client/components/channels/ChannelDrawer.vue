<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { X, Copy, Check, Search } from 'lucide-vue-next'
import { useChannelDetail } from '../../composables/useChannels'
import { WHEEL_KINDS, filterWheels, stackLabel, osLabel } from '../../utils/channels'
import { formatShortDate, archBadgeClass } from '../../utils/formatting'
import ChannelName from './ChannelName.vue'
import MaturityBadge from './MaturityBadge.vue'

const props = defineProps({
  name: { type: String, default: null },
  // Sample catalogs carry made-up index URLs and pull specs, so copy actions are hidden.
  sample: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'view-base-images'])

const { channel, loading, error, load, reset } = useChannelDetail()

const activeTab = ref('drops')
const wheelQuery = ref('')
const wheelKind = ref('')
const copied = ref(null)
const closeButton = ref(null)
const panel = ref(null)
let previousFocus = null
let previousOverflow = ''
let copiedTimer = null

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

const open = computed(() => !!props.name)

watch(() => props.name, (name, oldName) => {
  if (!name) {
    reset()
    return
  }
  activeTab.value = 'drops'
  wheelQuery.value = ''
  wheelKind.value = ''
  load(name)
  if (!oldName) {
    previousFocus = document.activeElement
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    nextTick(() => closeButton.value?.focus())
  }
}, { immediate: true })

function releasePage() {
  document.body.style.overflow = previousOverflow
  previousOverflow = ''
}

watch(open, (isOpen) => {
  if (isOpen) return
  releasePage()
  previousFocus?.focus?.()
  previousFocus = null
})

onBeforeUnmount(() => {
  if (open.value) releasePage()
  clearTimeout(copiedTimer)
})

const wheels = computed(() => channel.value?.wheels || [])

const visibleWheels = computed(() =>
  filterWheels(wheels.value, { query: wheelQuery.value, kind: wheelKind.value })
)

// wheel_kinds is derived data an upstream source may not provide.
const kindSegments = computed(() => {
  const counts = channel.value?.wheel_kinds
  const total = channel.value?.wheel_count || 0
  if (!counts || !total) return []
  return Object.entries(WHEEL_KINDS).map(([kind, meta]) => ({
    kind,
    ...meta,
    count: counts[kind] || 0,
    percent: total ? ((counts[kind] || 0) / total) * 100 : 0,
  }))
})

const releases = computed(() => channel.value?.compatible_releases || [])
const drops = computed(() => channel.value?.drops || [])

const maturityNote = computed(() => {
  const c = channel.value
  if (!c) return ''
  if (c.maturity === 'stable') {
    const adopted = releases.value.length ? `Adopted by ${releases.value.join(', ')}. ` : ''
    return `${adopted}The torch and accelerator versions stay locked while CVE and bug fixes keep flowing.`
  }
  return 'Content flows continuously with no code freeze. Any team can adopt it once their own testing passes.'
})

function toggleKind(kind) {
  wheelKind.value = wheelKind.value === kind ? '' : kind
}

async function copy(text, key) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = key
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copied.value = null }, 1500)
  } catch { /* clipboard unavailable */ }
}

// Keyboard handling lives on the dialog itself: the drawer is modal, so keys
// pressed inside it must not reach page-level shortcuts (such as "/" opening
// the command palette underneath), and Tab stays within the panel.
function onKeydown(event) {
  event.stopPropagation()
  if (event.key === 'Escape') {
    if (event.defaultPrevented) return
    if (event.target?.tagName === 'INPUT' && wheelQuery.value) {
      wheelQuery.value = ''
      return
    }
    emit('close')
    return
  }
  if (event.key !== 'Tab' || !panel.value) return
  const focusables = panel.value.querySelectorAll(FOCUSABLE)
  if (!focusables.length) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  const active = document.activeElement
  if (event.shiftKey && (active === first || active === panel.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-gray-900/40 dark:bg-black/60" aria-hidden="true" @click="emit('close')"></div>
      <section
        ref="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="channel-drawer-title"
        tabindex="-1"
        class="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-white dark:bg-gray-900 shadow-2xl focus:outline-none motion-safe:animate-[channel-drawer-in_180ms_ease-out]"
        data-testid="channel-drawer"
        @keydown="onKeydown"
      >
        <!-- Header -->
        <header class="border-b border-gray-200 dark:border-gray-700 px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <h2 id="channel-drawer-title" class="min-w-0 overflow-x-auto">
              <ChannelName v-if="channel" :channel="channel" size="lg" />
              <span v-else class="font-mono text-lg sm:text-xl text-gray-900 dark:text-gray-100">{{ name }}</span>
            </h2>
            <button
              ref="closeButton"
              type="button"
              class="shrink-0 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="Close channel details"
              @click="emit('close')"
            >
              <X :size="18" />
            </button>
          </div>
          <div v-if="channel" class="mt-2 flex flex-wrap items-center gap-2">
            <MaturityBadge :maturity="channel.maturity" />
            <span
              v-if="sample"
              class="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              title="Sample data: the index URL and image pull specs are illustrative"
            >Sample data</span>
            <span class="text-sm text-gray-600 dark:text-gray-400">{{ channel.description }}</span>
          </div>
        </header>

        <div class="flex-1 overflow-y-auto px-5 py-5">
          <!-- Loading -->
          <div v-if="loading" class="space-y-3 animate-pulse" aria-live="polite">
            <div class="h-16 rounded-lg bg-gray-100 dark:bg-gray-800"></div>
            <div class="h-8 rounded-lg bg-gray-100 dark:bg-gray-800"></div>
            <div class="h-40 rounded-lg bg-gray-100 dark:bg-gray-800"></div>
          </div>

          <!-- Error -->
          <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <p class="text-sm text-red-700 dark:text-red-300">Could not load {{ name }}: {{ error }}</p>
            <button type="button" class="mt-2 text-sm font-medium text-red-700 underline dark:text-red-300" @click="load(name)">Try again</button>
          </div>

          <template v-else-if="channel">
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
              <h3 class="text-xs text-gray-500 dark:text-gray-400">Compatible releases</h3>
              <div v-if="releases.length" class="mt-1 flex flex-wrap gap-1.5">
                <span
                  v-for="release in releases"
                  :key="release"
                  class="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >{{ release }}</span>
              </div>
              <p v-else class="mt-1 text-sm text-gray-500 dark:text-gray-400">No product release has adopted this channel yet.</p>
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-prose">{{ maturityNote }}</p>
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
                <span>Images published to <code class="text-gray-700 dark:text-gray-300">{{ channel.base_image }}</code></span>
                <button
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
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ drop.name }}</span>
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
          </template>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style>
@keyframes channel-drawer-in {
  from { transform: translateX(2rem); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
</style>
