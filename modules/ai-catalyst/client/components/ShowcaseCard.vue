<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60
           hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200 cursor-pointer overflow-hidden"
    @click="$emit('click')"
  >
    <div class="aspect-video bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
      <img
        v-if="previewImage"
        :src="previewImage"
        :alt="entry.title"
        class="w-full h-full object-contain"
        loading="lazy"
        @error="imgError = true"
      />
      <div v-if="!previewImage || imgError" class="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-700 dark:to-gray-600 absolute inset-0">
        <component :is="SparklesIcon" :size="40" class="text-blue-300 dark:text-gray-500" />
      </div>
      <span
        v-if="featured"
        class="absolute top-2 right-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-yellow-400 text-yellow-900"
      >
        Featured
      </span>
    </div>

    <div class="p-4">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-1">
        {{ entry.title }}
      </h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 mb-3">
        {{ entry.shortSummary }}
      </p>

      <div class="flex flex-wrap gap-1.5">
        <PillBadge v-if="pillarTitle" :label="pillarTitle" variant="strategy" />
        <PillBadge v-if="lineageLabel" :label="lineageLabel" variant="lineage" />
        <PillBadge
          v-if="entry.customerNeedTags && entry.customerNeedTags[0]"
          :label="entry.customerNeedTags[0]"
          variant="need"
        />
        <PillBadge
          v-if="entry.capabilityTags && entry.capabilityTags[0]"
          :label="entry.capabilityTags[0]"
          variant="capability"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Sparkles as SparklesIcon } from 'lucide-vue-next'
import PillBadge from './PillBadge.vue'

const props = defineProps({
  entry: { type: Object, required: true },
  pillarTitle: { type: String, default: '' },
  featured: { type: Boolean, default: false },
})

defineEmits(['click'])

const lineageLabels = {
  'pure-open-source': 'Open Source',
  'openshift-oriented': 'OpenShift',
  both: 'Open Source + OpenShift',
}

const lineageLabel = computed(() => lineageLabels[props.entry.lineage] || '')

const imgError = ref(false)

const previewImage = computed(() => {
  if (imgError.value) return null
  if (props.entry.posterImageUrl && props.entry.posterImageUrl.startsWith('http')) return props.entry.posterImageUrl
  const urls = props.entry.githubUrl
  if (!urls) return null
  const first = Array.isArray(urls) ? urls[0] : String(urls).split('|')[0]?.trim()
  if (!first) return null
  try {
    const parsed = new URL(first)
    if (parsed.hostname !== 'github.com') return null
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) {
      return `https://opengraph.githubassets.com/1/${parts[0]}/${parts[1]}`
    }
  } catch { /* ignore */ }
  return null
})
</script>
