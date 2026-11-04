<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { X } from 'lucide-vue-next'
import { useChannelDetail } from '../../composables/useChannels'
import ChannelName from './ChannelName.vue'
import ChannelDetails from './ChannelDetails.vue'

const props = defineProps({
  name: { type: String, default: null },
  // Sample catalogs carry made-up index URLs and pull specs, so copy actions are hidden.
  sample: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'view-base-images', 'view-drop'])

const { channel, loading, error, load, reset } = useChannelDetail()

const closeButton = ref(null)
const panel = ref(null)
const details = ref(null)
let previousFocus = null
let previousOverflow = ''

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

const open = computed(() => !!props.name)

watch(() => props.name, (name, oldName) => {
  if (!name) {
    reset()
    return
  }
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
})

// Keyboard handling lives on the dialog itself: the drawer is modal, so keys
// pressed inside it must not reach page-level shortcuts (such as "/" opening
// the command palette underneath), and Tab stays within the panel.
function onKeydown(event) {
  event.stopPropagation()
  if (event.key === 'Escape') {
    if (event.defaultPrevented) return
    if (event.target?.tagName === 'INPUT' && details.value?.hasWheelFilter) {
      details.value.clearWheelFilter()
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

          <ChannelDetails
            v-else-if="channel"
            ref="details"
            :channel="channel"
            :sample="sample"
            @view-base-images="emit('view-base-images')"
            @view-drop="emit('view-drop', $event)"
          />
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
