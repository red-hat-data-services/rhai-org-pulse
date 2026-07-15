<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { PLACEMENTS } from '../utils/draft-plan-model.js'

var props = defineProps({
  feature: { type: Object, default: null },
  jiraBaseUrl: { type: String, default: 'https://issues.redhat.com/browse' }
})

var emit = defineEmits([
  'close',
  'move',
  'descope',
  'undescope',
  'approve'
])

var open = computed(function() {
  return props.feature !== null
})

function onKey(e) {
  if (e.key === 'Escape' && open.value) emit('close')
}

onMounted(function() {
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(function() {
  window.removeEventListener('keydown', onKey)
})

function onMoveChange(event) {
  var placement = event.target.value
  if (!placement || !props.feature) return
  emit('move', props.feature.key, placement)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dp-fade">
      <div
        v-if="open"
        class="fixed inset-0 z-30 bg-black/20 dark:bg-black/50"
        aria-hidden="true"
        @click="emit('close')"
      />
    </Transition>

    <Transition name="dp-slide">
      <aside
        v-if="open && feature"
        role="complementary"
        aria-label="Draft plan feature detail"
        class="fixed top-0 right-0 z-40 h-full w-[440px] flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-2xl"
      >
        <div class="px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 shrink-0">
          <div class="flex items-start gap-2">
            <span class="inline-flex items-center gap-1 shrink-0 mt-0.5">
              <a
                :href="jiraBaseUrl + '/' + feature.key"
                target="_blank"
                rel="noopener noreferrer"
                class="font-mono text-xs font-bold text-primary-600 dark:text-blue-400 hover:underline"
                @click.stop
              >{{ feature.key }}</a>
            </span>
            <p class="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
              {{ feature.summary || '—' }}
            </p>
            <button
              type="button"
              class="shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Close detail panel"
              @click="emit('close')"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="flex flex-wrap gap-1.5 mt-2.5">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
              {{ feature.event }}
            </span>
            <span
              v-if="feature.changed"
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
            >Edited</span>
            <span
              v-if="feature.approved"
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
            >Approved</span>
            <span
              v-if="feature.frozen"
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
            >Frozen</span>
            <span
              v-if="!feature.editable"
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
            >Read-only</span>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
          <section class="px-4 py-4">
            <p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
              Placement
            </p>
            <dl class="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-xs">
              <dt class="text-gray-400 dark:text-gray-500">Base</dt>
              <dd class="text-gray-700 dark:text-gray-300">{{ feature.basePlacement }}</dd>
              <dt class="text-gray-400 dark:text-gray-500">Effective</dt>
              <dd class="text-gray-900 dark:text-gray-100 font-semibold">{{ feature.event }}</dd>
              <dt class="text-gray-400 dark:text-gray-500">Product</dt>
              <dd class="text-gray-700 dark:text-gray-300">{{ feature.productFamily || '—' }}</dd>
              <dt class="text-gray-400 dark:text-gray-500">Component</dt>
              <dd class="text-gray-700 dark:text-gray-300">{{ feature.component || '—' }}</dd>
              <dt class="text-gray-400 dark:text-gray-500">Assignee</dt>
              <dd class="text-gray-700 dark:text-gray-300">{{ feature.assignee || '—' }}</dd>
              <dt class="text-gray-400 dark:text-gray-500">Ready</dt>
              <dd class="text-gray-700 dark:text-gray-300">{{ feature.ready || '—' }}</dd>
              <dt class="text-gray-400 dark:text-gray-500">Place reason</dt>
              <dd class="text-gray-700 dark:text-gray-300 break-all">{{ feature.placeReason || '—' }}</dd>
              <dt class="text-gray-400 dark:text-gray-500">Capacity src</dt>
              <dd class="text-gray-700 dark:text-gray-300">{{ feature.capacitySource || '—' }}</dd>
              <dt class="text-gray-400 dark:text-gray-500">Proposed FV</dt>
              <dd class="font-mono text-gray-700 dark:text-gray-300">{{ feature.proposedFixVersion || '—' }}</dd>
            </dl>
          </section>

          <section class="px-4 py-4 space-y-3">
            <p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              Red-pen actions
            </p>
            <p class="text-[11px] text-gray-500 dark:text-gray-400">
              Keep is implicit — leave placement unchanged. Move / Descope write a decision overlay.
            </p>

            <label class="block text-xs text-gray-500 dark:text-gray-400">
              Move to
              <select
                class="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-2 py-1.5 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                :disabled="!feature.editable || feature.decision === 'descope'"
                :value="feature.decision === 'descope' ? '' : (feature.event === 'Descope' ? '' : feature.event)"
                @change="onMoveChange"
              >
                <option disabled value="">Select placement…</option>
                <option v-for="p in PLACEMENTS" :key="p" :value="p">{{ p }}</option>
              </select>
            </label>

            <div class="flex flex-wrap gap-2">
              <button
                v-if="feature.decision !== 'descope'"
                type="button"
                class="px-3 py-1.5 text-xs font-medium rounded-md border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                :disabled="!feature.editable"
                @click="emit('descope', feature.key)"
              >
                Descope
              </button>
              <button
                v-else
                type="button"
                class="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                :disabled="!feature.editable"
                @click="emit('undescope', feature.key)"
              >
                Undo descope
              </button>
            </div>

            <label class="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                class="rounded border-gray-300 dark:border-gray-600"
                :checked="feature.approved"
                :disabled="!feature.editable || feature.decision === 'descope'"
                @change="emit('approve', feature.key, $event.target.checked)"
              />
              Owner approve (commitment)
            </label>
          </section>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dp-fade-enter-active,
.dp-fade-leave-active { transition: opacity 0.22s ease; }
.dp-fade-enter-from,
.dp-fade-leave-to { opacity: 0; }

.dp-slide-enter-active,
.dp-slide-leave-active { transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
.dp-slide-enter-from,
.dp-slide-leave-to { transform: translateX(100%); }
</style>
