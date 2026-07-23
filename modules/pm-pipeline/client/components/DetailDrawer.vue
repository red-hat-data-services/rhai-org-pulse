<script setup>
import { computed } from 'vue'
import PipelineTimeline from './PipelineTimeline.vue'

const props = defineProps({
  item: { type: Object, default: null }
})

const emit = defineEmits(['close'])

const open = computed(() => !!props.item)

function linkForStep(index) {
  const links = props.item?.playbook?.stepLinks?.[index]
  return links?.[0] || null
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-40 bg-black/40"
        @click="emit('close')"
      />
    </Transition>
    <Transition name="slide">
      <aside
        v-if="open && item"
        class="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-xl flex flex-col"
      >
        <header class="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 bg-gray-50">
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-mono font-semibold text-blue-600">{{ item.id }}</span>
              <a
                :href="item.links.jira"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-blue-600 hover:underline"
              >Open in Jira ↗</a>
            </div>
            <p class="text-sm font-medium text-gray-900 mt-1">{{ item.summary }}</p>
            <p class="text-xs text-gray-500 mt-1">{{ item.stage.label }}</p>
          </div>
          <button
            type="button"
            class="p-2 text-gray-400 hover:text-gray-600 rounded-md"
            aria-label="Close"
            @click="emit('close')"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <!-- Timeline -->
          <section>
            <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Pipeline progress</h3>
            <PipelineTimeline :timeline="item.timeline" />
          </section>

          <!-- Readiness gates -->
          <section v-if="item.readiness && !item.readiness.isReady">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Failed readiness gates</h3>
            <ul class="space-y-2">
              <li
                v-for="gate in item.readiness.failedGates"
                :key="gate.id"
                class="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-md px-3 py-2"
              >
                <span class="text-red-500">✕</span>
                {{ gate.label }}
              </li>
            </ul>
          </section>

          <!-- Playbook -->
          <section v-if="item.playbook">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
              What to do — §{{ item.playbook.section }}
            </h3>
            <p class="text-sm font-medium text-gray-900 mb-1">{{ item.playbook.title }}</p>
            <p class="text-xs text-gray-500 mb-3">Owner: {{ item.playbook.owner }}</p>
            <ol class="space-y-3 list-decimal list-inside text-sm text-gray-700">
              <li v-for="(step, idx) in item.playbook.steps" :key="idx" class="pl-1">
                <span>{{ step }}</span>
                <a
                  v-if="linkForStep(idx)"
                  :href="linkForStep(idx).url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="ml-2 inline-flex items-center text-xs font-medium text-blue-600 hover:underline"
                >{{ linkForStep(idx).label }} ↗</a>
              </li>
            </ol>
          </section>

          <!-- Context links -->
          <section v-if="item.links.context?.length">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Learn more</h3>
            <ul class="space-y-2">
              <li v-for="link in item.links.context" :key="link.url">
                <a
                  :href="link.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  {{ link.label }}
                  <span class="text-xs text-gray-400">↗</span>
                </a>
                <p v-if="link.description" class="text-xs text-gray-500 mt-0.5">{{ link.description }}</p>
              </li>
            </ul>
          </section>

          <!-- Related tickets -->
          <section v-if="item.links.related?.length">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Related tickets</h3>
            <ul class="space-y-1">
              <li v-for="rel in item.links.related" :key="rel.url">
                <a
                  :href="rel.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-blue-600 hover:underline"
                >{{ rel.label }} ↗</a>
              </li>
            </ul>
          </section>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
