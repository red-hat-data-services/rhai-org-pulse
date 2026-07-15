<script setup>
import StatsStrip from '../components/StatsStrip.vue'
import PipelineCard from '../components/PipelineCard.vue'
import ActionGroups from '../components/ActionGroups.vue'

defineProps({
  stats: { type: Object, required: true },
  heroItem: { type: Object, default: null },
  actionGroups: { type: Array, default: () => [] },
  waitingItems: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  fetchedAt: { type: String, default: null }
})

const emit = defineEmits(['select', 'export'])
</script>

<template>
  <main class="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div v-if="fetchedAt" class="text-xs text-gray-400 order-2 sm:order-1">
        Last fetched {{ new Date(fetchedAt).toLocaleString() }} · cached ~15 min
      </div>
      <button
        type="button"
        class="order-1 sm:order-2 self-start sm:self-auto rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        :disabled="loading || stats.total === 0"
        @click="emit('export')"
      >
        Copy planning prep for Confluence
      </button>
    </div>

    <div v-if="error" class="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
      {{ error }}
    </div>

    <div v-if="loading" class="text-center py-16 text-gray-500">
      Loading your pipeline from Jira…
    </div>

    <template v-else-if="!error || stats.total > 0">
      <StatsStrip :stats="stats" />

      <section v-if="heroItem">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Most urgent</p>
        <PipelineCard :item="heroItem" hero @select="emit('select', $event)" />
      </section>

      <section>
        <h2 class="text-lg font-semibold text-gray-900 mb-3">Action needed</h2>
        <ActionGroups :groups="actionGroups" @select="emit('select', $event)" />
      </section>

      <section v-if="waitingItems.length > 0">
        <h2 class="text-lg font-semibold text-gray-900 mb-3">Waiting on others</h2>
        <div class="space-y-2">
          <PipelineCard
            v-for="item in waitingItems"
            :key="item.id"
            :item="item"
            @select="emit('select', $event)"
          />
        </div>
      </section>
    </template>
  </main>
</template>
