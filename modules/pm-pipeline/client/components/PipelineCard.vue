<script setup>
import { computed } from 'vue'
import { stageAccentClass } from '../utils/action-groups.js'

const props = defineProps({
  item: { type: Object, required: true },
  hero: { type: Boolean, default: false }
})

const emit = defineEmits(['select'])

const accent = computed(() => stageAccentClass(props.item))

const waitClass = computed(() => {
  const d = props.item.waitDays
  if (d >= 14) return 'bg-red-100 text-red-700'
  if (d >= 7) return 'bg-amber-100 text-amber-800'
  return 'bg-gray-100 text-gray-600'
})

const summary = computed(() => {
  const s = props.item.summary || ''
  if (props.hero) return s
  return s.length > 140 ? s.slice(0, 140) + '…' : s
})

const firstStep = computed(() => props.item.playbook?.steps?.[0] || null)
</script>

<template>
  <article
    class="rounded-lg bg-white border border-gray-200 border-l-4 cursor-pointer hover:shadow-md transition-shadow"
    :class="accent"
    @click="emit('select', item)"
  >
    <div class="p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="font-mono text-sm font-semibold text-blue-600">{{ item.id }}</span>
          <a
            :href="item.links.jira"
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-400 hover:text-gray-600"
            title="Open in Jira"
            @click.stop
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <span class="text-xs uppercase text-gray-400">{{ item.type }}</span>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
            {{ item.stage.label }}
          </span>
          <span v-if="item.waitDays > 0" class="text-xs font-medium px-2 py-0.5 rounded-full" :class="waitClass">
            {{ item.waitDays }}d waiting
          </span>
        </div>
      </div>

      <h3 class="text-sm font-medium text-gray-900 mt-2" :class="{ 'text-base': hero }">{{ summary }}</h3>

      <p v-if="firstStep && hero" class="text-sm text-gray-600 mt-2 line-clamp-2">
        <span class="font-medium text-gray-800">Next:</span> {{ firstStep }}
      </p>

      <p v-if="hero" class="text-xs text-blue-600 mt-3 font-medium">Click for full playbook and links →</p>
    </div>
  </article>
</template>
