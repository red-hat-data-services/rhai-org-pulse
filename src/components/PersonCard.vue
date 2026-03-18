<template>
  <div
    class="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-primary-300 hover:shadow-sm transition-all"
    @click="$emit('select', member)"
  >
    <div class="flex items-start justify-between">
      <div class="min-w-0">
        <h4 class="text-sm font-semibold text-gray-900 truncate">{{ member.name }}</h4>
        <SpecialtyBadge :specialty="member.specialty" class="mt-1" />
      </div>
      <span
        v-if="teamCount > 1"
        class="flex-shrink-0 ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700"
        :title="`Member of ${teamCount} teams`"
      >
        {{ teamCount }} teams
      </span>
    </div>
    <div class="mt-2 text-xs text-gray-500 space-y-0.5">
      <p v-if="member.manager" class="truncate">
        <span class="text-gray-400">Mgr:</span> {{ member.manager }}
      </p>
      <p v-if="member.jiraComponent" class="truncate">
        <span class="text-gray-400">Component:</span> {{ member.jiraComponent }}
      </p>
      <p v-if="metrics" class="truncate">
        <span class="text-gray-400">Resolved (90d):</span> {{ metrics.resolvedCount ?? '--' }}
        <span class="mx-1 text-gray-300">·</span>
        <span class="text-gray-400">Points:</span> {{ metrics.resolvedPoints ?? '--' }}
      </p>
      <p class="truncate">
        <span class="text-gray-400">GitHub:</span>
        <template v-if="githubContributions != null">{{ githubContributions.totalContributions }} contributions</template>
        <span v-else-if="member.githubUsername" class="text-gray-300">—</span>
        <span v-else class="text-gray-300 italic text-xs" title="GitHub username not configured">no GitHub</span>
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SpecialtyBadge from './SpecialtyBadge.vue'
import { useGithubStats } from '../composables/useGithubStats'

const props = defineProps({
  member: { type: Object, required: true },
  teamCount: { type: Number, default: 1 },
  metrics: { type: Object, default: null }
})
defineEmits(['select'])

const { getContributions } = useGithubStats()
const githubContributions = computed(() => getContributions(props.member.githubUsername))
</script>
