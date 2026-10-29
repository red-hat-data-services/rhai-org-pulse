<script setup>
import { computed, watch, onMounted, inject } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import { useChannelDetail } from '../composables/useChannels'
import ChannelName from '../components/channels/ChannelName.vue'
import ChannelDetails from '../components/channels/ChannelDetails.vue'

const nav = inject('moduleNav')

const channelName = computed(() => nav.params.value?.channel || null)
const { channel, source, loading, error, load, reset } = useChannelDetail()

const sample = computed(() => source.value === 'sample')

watch(channelName, (name) => {
  if (name) {
    load(name)
  } else {
    reset()
  }
}, { immediate: true })

onMounted(() => window.scrollTo({ top: 0 }))

function goBack() {
  nav.navigateTo('base-images')
}

function viewDrop(drop) {
  if (!drop?.key) return
  nav.navigateTo('drop-detail', {
    key: drop.key,
    product: 'base-images',
    channel: channelName.value || undefined,
  })
}
</script>

<template>
  <div class="max-w-4xl space-y-6">
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded text-sm font-medium text-gray-600 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-gray-400 dark:hover:text-gray-200"
      @click="goBack"
    >
      <ArrowLeft :size="16" aria-hidden="true" />
      Back to Base Images
    </button>

    <div v-if="!channelName" class="text-sm text-gray-500 dark:text-gray-400">
      No channel selected.
    </div>

    <div v-else-if="loading" class="space-y-3 animate-pulse" aria-live="polite">
      <div class="h-10 w-80 max-w-full rounded-lg bg-gray-100 dark:bg-gray-800"></div>
      <div class="h-16 rounded-lg bg-gray-100 dark:bg-gray-800"></div>
      <div class="h-8 rounded-lg bg-gray-100 dark:bg-gray-800"></div>
      <div class="h-40 rounded-lg bg-gray-100 dark:bg-gray-800"></div>
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <p class="text-sm text-red-700 dark:text-red-300">Could not load {{ channelName }}: {{ error }}</p>
      <button type="button" class="mt-2 text-sm font-medium text-red-700 underline dark:text-red-300" @click="load(channelName)">Try again</button>
    </div>

    <template v-else-if="channel">
      <header class="border-b border-gray-200 pb-4 dark:border-gray-700">
        <h1 class="min-w-0 overflow-x-auto">
          <ChannelName :channel="channel" size="lg" />
        </h1>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <span
            v-if="sample"
            class="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            title="Sample data: the index URL and image pull specs are illustrative"
          >Sample data</span>
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ channel.description }}</span>
        </div>
      </header>

      <ChannelDetails
        :channel="channel"
        :sample="sample"
        :show-view-all-base-images="false"
        @view-drop="viewDrop"
      />
    </template>
  </div>
</template>
