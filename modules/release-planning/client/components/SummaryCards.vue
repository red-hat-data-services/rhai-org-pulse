<script setup>
import { computed } from 'vue'

const props = defineProps({
  summary: { type: Object, default: null },
  healthSummary: { type: Object, default: null }
})

const hasHealth = computed(function() {
  return props.healthSummary && props.healthSummary.byRisk
})
</script>

<template>
  <div v-if="summary" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <!-- Tier 1 -->
    <div class="p-4 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
      <div class="text-sm font-semibold text-blue-700 dark:text-blue-400">Tier 1: Milestone Essentials</div>
      <div class="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5 leading-snug">Must-have for release milestones</div>
      <div class="flex items-baseline gap-4 mt-3">
        <div>
          <span class="text-2xl font-bold text-blue-700 dark:text-blue-400">{{ summary.tier1 ? summary.tier1.features : 0 }}</span>
          <span class="text-xs text-blue-600/70 dark:text-blue-400/70 ml-1">Features</span>
        </div>
        <div>
          <span class="text-2xl font-bold text-blue-700 dark:text-blue-400">{{ summary.tier1 ? summary.tier1.rfes : 0 }}</span>
          <span class="text-xs text-blue-600/70 dark:text-blue-400/70 ml-1">RFEs</span>
        </div>
      </div>
    </div>

    <!-- Tier 2 -->
    <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
      <div class="text-sm font-semibold text-amber-700 dark:text-amber-400">Tier 2: Enhancements</div>
      <div class="text-xs text-amber-600/70 dark:text-amber-400/70 mt-0.5 leading-snug">High-value UX/Customer impact</div>
      <div class="flex items-baseline gap-4 mt-3">
        <div>
          <span class="text-2xl font-bold text-amber-700 dark:text-amber-400">{{ summary.tier2 ? summary.tier2.features : 0 }}</span>
          <span class="text-xs text-amber-600/70 dark:text-amber-400/70 ml-1">Features</span>
        </div>
        <div>
          <span class="text-2xl font-bold text-amber-700 dark:text-amber-400">{{ summary.tier2 ? summary.tier2.rfes : 0 }}</span>
          <span class="text-xs text-amber-600/70 dark:text-amber-400/70 ml-1">RFEs</span>
        </div>
      </div>
    </div>

    <!-- Tier 3 -->
    <div class="p-4 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30">
      <div class="text-sm font-semibold text-violet-700 dark:text-violet-400">Tier 3: Collaborative Support</div>
      <div class="text-xs text-violet-600/70 dark:text-violet-400/70 mt-0.5 leading-snug">Cross-team priorities</div>
      <div class="flex items-baseline gap-4 mt-3">
        <div>
          <span class="text-2xl font-bold text-violet-700 dark:text-violet-400">{{ summary.tier3 ? summary.tier3.features : 0 }}</span>
          <span class="text-xs text-violet-600/70 dark:text-violet-400/70 ml-1">Features</span>
        </div>
        <div>
          <span class="text-2xl font-bold text-violet-700 dark:text-violet-400">{{ summary.tier3 ? summary.tier3.rfes : 0 }}</span>
          <span class="text-xs text-violet-600/70 dark:text-violet-400/70 ml-1">RFEs</span>
        </div>
      </div>
    </div>

    <!-- Totals -->
    <div class="p-4 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30">
      <div class="text-sm font-semibold text-green-700 dark:text-green-400">Totals</div>
      <div class="text-xs text-green-600/70 dark:text-green-400/70 mt-0.5 leading-snug">All features and RFEs across all tiers</div>
      <div class="flex items-baseline gap-4 mt-3">
        <div>
          <span class="text-2xl font-bold text-green-700 dark:text-green-400">{{ summary.totalFeatures }}</span>
          <span class="text-xs text-green-600/70 dark:text-green-400/70 ml-1">Features</span>
        </div>
        <div>
          <span class="text-2xl font-bold text-green-700 dark:text-green-400">{{ summary.totalRfes }}</span>
          <span class="text-xs text-green-600/70 dark:text-green-400/70 ml-1">RFEs</span>
        </div>
      </div>
      <!-- Health indicator -->
      <div v-if="hasHealth" class="flex items-center gap-2 mt-3 pt-2 border-t border-green-200/50 dark:border-green-500/20">
        <span class="text-[10px] text-green-600/70 dark:text-green-400/70 uppercase tracking-wide">Health</span>
        <div class="flex items-center gap-1.5">
          <span class="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-700 dark:text-green-400">
            <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>{{ healthSummary.byRisk.green || 0 }}
          </span>
          <span class="inline-flex items-center gap-0.5 text-[10px] font-semibold text-yellow-700 dark:text-yellow-400">
            <span class="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>{{ healthSummary.byRisk.yellow || 0 }}
          </span>
          <span class="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-700 dark:text-red-400">
            <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>{{ healthSummary.byRisk.red || 0 }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
