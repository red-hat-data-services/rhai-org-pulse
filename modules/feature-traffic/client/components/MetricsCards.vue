<script setup>
defineProps({
  metrics: { type: Object, required: true }
})
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
    <div class="bg-surface rounded-lg p-4 border border-gray-700">
      <div class="text-2xl font-bold text-white">{{ metrics.totalEpics }}</div>
      <div class="text-xs text-gray-400 mt-1">Epics</div>
    </div>
    <div class="bg-surface rounded-lg p-4 border border-gray-700">
      <div class="text-2xl font-bold text-white">{{ metrics.totalIssues }}</div>
      <div class="text-xs text-gray-400 mt-1">Issues</div>
    </div>
    <div class="bg-surface rounded-lg p-4 border border-gray-700">
      <div class="text-2xl font-bold" :class="{
        'text-green-400': metrics.completionPct >= 70,
        'text-yellow-400': metrics.completionPct >= 40 && metrics.completionPct < 70,
        'text-red-400': metrics.completionPct < 40
      }">{{ metrics.completionPct }}%</div>
      <div class="text-xs text-gray-400 mt-1">Complete</div>
    </div>
    <div class="bg-surface rounded-lg p-4 border border-gray-700">
      <div class="text-2xl font-bold text-white">
        {{ metrics.storyPointsDone || 0 }}<span class="text-gray-500 text-lg">/{{ metrics.totalStoryPoints || 0 }}</span>
      </div>
      <div class="text-xs text-gray-400 mt-1">Story Points</div>
    </div>
    <div class="bg-surface rounded-lg p-4 border border-gray-700">
      <div class="text-2xl font-bold" :class="metrics.blockerCount > 0 ? 'text-red-400' : 'text-gray-500'">
        {{ metrics.blockerCount }}
      </div>
      <div class="text-xs text-gray-400 mt-1">Blockers</div>
    </div>
    <div class="bg-surface rounded-lg p-4 border border-gray-700">
      <div class="text-2xl font-bold" :class="metrics.staleCount > 0 ? 'text-yellow-400' : 'text-gray-500'">
        {{ metrics.staleCount }}
      </div>
      <div class="text-xs text-gray-400 mt-1">Stale Items</div>
    </div>
  </div>
</template>
