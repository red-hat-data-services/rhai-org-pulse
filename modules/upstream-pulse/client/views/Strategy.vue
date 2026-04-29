<template>
  <div>
    <StickyPageHeader
      v-model="selectedDays"
      title="Strategy"
      subtitle="Track progress against upstream strategic goals"
      :loading="loading"
    />

    <!-- Loading -->
    <div v-if="loading">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
        <StatCardSkeleton v-for="i in 3" :key="'ts'+i" />
      </div>
      <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-4 w-80 mb-8"></div>
      <div v-for="i in 2" :key="'sec'+i" class="mb-6">
        <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-5 w-48 mb-3"></div>
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700/60">
          <table class="min-w-full"><thead class="bg-gray-50 dark:bg-gray-750"><tr><th v-for="j in 6" :key="j" class="px-4 py-3"><div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-3 w-14"></div></th></tr></thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700"><TableRowSkeleton v-for="j in 3" :key="'r'+j" :cols="6" /></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Error loading strategy data</h3>
      <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="strategicOrgs.length === 0" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 p-12 text-center">
      <div class="w-14 h-14 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
        <TargetIcon :size="28" class="text-gray-400 dark:text-gray-500" />
      </div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No strategic classifications assigned</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">Tag organizations in the org registry with strategic participation or leadership goals to track them here.</p>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Tier Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
        <button
          v-for="tier in tierOrder"
          :key="tier"
          @click="toggleTier(tier)"
          class="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border-l-4 border border-gray-100 dark:border-gray-700/60 p-5 text-left transition-all duration-200"
          :class="[
            TIER_CONFIG[tier].borderClass,
            selectedTier === tier
              ? 'ring-2 shadow-md scale-[1.02] ' + TIER_CONFIG[tier].ringClass
              : selectedTier && selectedTier !== tier
                ? 'opacity-50'
                : 'hover:shadow-md hover:scale-[1.01]',
          ]"
        >
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-semibold" :class="TIER_CONFIG[tier].textClass">
              {{ TIER_CONFIG[tier].label }}
            </span>
            <span class="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50 px-2 py-0.5 rounded-full">
              {{ tierSummaries[tier].count }} {{ tierSummaries[tier].count === 1 ? 'community' : 'communities' }}
            </span>
          </div>
          <div class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1 tabular-nums">
            {{ tierSummaries[tier].contributions.toLocaleString() }}
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">team contributions</p>
          <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span class="flex items-center gap-1">
              <CrownIcon :size="12" class="text-amber-500" />
              {{ tierSummaries[tier].leaders }} {{ tierSummaries[tier].leaders === 1 ? 'leader' : 'leaders' }}
            </span>
            <span class="flex items-center gap-1">
              <ShieldIcon :size="12" class="text-blue-500" />
              {{ tierSummaries[tier].maintainers }} {{ tierSummaries[tier].maintainers === 1 ? 'maintainer' : 'maintainers' }}
            </span>
            <span
              v-if="selectedDays !== '0' && tierSummaries[tier].count > 0"
              class="ml-auto text-[11px] font-medium px-1.5 py-0.5 rounded-full"
              :class="tierSummaries[tier].avgChange > 0
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                : tierSummaries[tier].avgChange < 0
                  ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                  : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50'"
            >
              {{ tierSummaries[tier].avgChange > 0 ? '↑' : tierSummaries[tier].avgChange < 0 ? '↓' : '→' }}
              {{ Math.abs(tierSummaries[tier].avgChange).toFixed(1) }}%
            </span>
          </div>
        </button>
      </div>

      <!-- Inline Stat Strip -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400 mb-8 px-1">
        <span class="font-medium text-gray-700 dark:text-gray-300">{{ statStrip.communities }} {{ statStrip.communities === 1 ? 'community' : 'communities' }}</span>
        <span class="text-gray-300 dark:text-gray-600 hidden sm:inline">&middot;</span>
        <span>{{ statStrip.contributions.toLocaleString() }} contributions</span>
        <span class="text-gray-300 dark:text-gray-600 hidden sm:inline">&middot;</span>
        <span>{{ statStrip.avgShare }}% avg share</span>
        <span class="text-gray-300 dark:text-gray-600 hidden sm:inline">&middot;</span>
        <span>{{ statStrip.leaders }} leaders</span>
        <button
          v-if="selectedTier"
          @click="selectedTier = null"
          class="ml-auto text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
        >
          Show all tiers &rarr;
        </button>
      </div>

      <!-- Tier-grouped community tables -->
      <div v-for="tier in visibleTiers" :key="tier" class="mb-8">
        <div class="flex items-center gap-3 mb-3">
          <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="TIER_CONFIG[tier].dotClass"></span>
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ TIER_CONFIG[tier].label }} Investment</h3>
          <span class="text-sm text-gray-400 dark:text-gray-500">{{ tierGroups[tier].length }} {{ tierGroups[tier].length === 1 ? 'community' : 'communities' }}</span>
          <span class="ml-auto text-sm font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{{ tierSummaries[tier].contributions.toLocaleString() }} <span class="font-normal text-gray-400 dark:text-gray-500">contributions</span></span>
        </div>

        <div v-if="tierGroups[tier].length === 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700/60 p-6 text-center">
          <p class="text-sm text-gray-400 dark:text-gray-500">No communities in this tier</p>
        </div>

        <div v-else class="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-x-auto border border-gray-100 dark:border-gray-700/60">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-750">
              <tr>
                <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Community</th>
                <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Strategy</th>
                <th class="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Contributions</th>
                <th class="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Team Share</th>
                <th class="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Leaders</th>
                <th class="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Maintainers</th>
                <th class="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Projects</th>
                <th v-if="selectedDays !== '0'" class="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Trend</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700/50">
              <tr
                v-for="org in tierGroups[tier]"
                :key="org.githubOrg"
                class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                @click="nav.navigateTo('org-detail', { org: org.githubOrg })"
              >
                <td class="px-4 py-3">
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ org.name }}</span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-if="org.strategicParticipation"
                      class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                      :class="getStrategicBadgeClass(org.strategicParticipation)"
                    >{{ getStrategicLabel(org.strategicParticipation) }}</span>
                    <span
                      v-if="org.strategicLeadership"
                      class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                      :class="getStrategicBadgeClass(org.strategicLeadership)"
                    >{{ getStrategicLabel(org.strategicLeadership) }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-right">
                  <span class="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ (org.contributionCount || 0).toLocaleString() }}</span>
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <div class="w-12 bg-gray-100 dark:bg-gray-700 rounded-full h-1">
                      <div class="h-1 rounded-full transition-all duration-500" :class="TIER_CONFIG[tier].dotClass" :style="{ width: Math.min(org.teamSharePercent || 0, 100) + '%' }"></div>
                    </div>
                    <span class="text-sm text-gray-700 dark:text-gray-300 tabular-nums">{{ Number(org.teamSharePercent || 0).toFixed(1) }}%</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300 tabular-nums">{{ org.leadershipCount || 0 }}</td>
                <td class="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300 tabular-nums">{{ org.maintainerCount || 0 }}</td>
                <td class="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300 tabular-nums">{{ org.projectCount || 0 }}</td>
                <td v-if="selectedDays !== '0'" class="px-4 py-3 text-right">
                  <span
                    v-if="org.percentChange != null"
                    class="text-[11px] font-medium px-1.5 py-0.5 rounded-full"
                    :class="org.percentChange > 0
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                      : org.percentChange < 0
                        ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                        : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50'"
                  >
                    {{ org.percentChange > 0 ? '↑' : org.percentChange < 0 ? '↓' : '→' }}{{ Math.abs(org.percentChange).toFixed(1) }}%
                  </span>
                </td>
              </tr>
            </tbody>
            <!-- Subtotal row -->
            <tfoot class="bg-gray-50 dark:bg-gray-750/50">
              <tr>
                <td class="px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-400" colspan="2">Subtotal</td>
                <td class="px-4 py-2.5 text-right text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ tierSummaries[tier].contributions.toLocaleString() }}</td>
                <td class="px-4 py-2.5 text-right text-sm font-semibold text-gray-600 dark:text-gray-400 tabular-nums">
                  {{ tierGroups[tier].length > 0 ? (tierGroups[tier].reduce((s, o) => s + (o.teamSharePercent || 0), 0) / tierGroups[tier].length).toFixed(1) : '0.0' }}% avg
                </td>
                <td class="px-4 py-2.5 text-right text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ tierSummaries[tier].leaders }}</td>
                <td class="px-4 py-2.5 text-right text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ tierSummaries[tier].maintainers }}</td>
                <td class="px-4 py-2.5 text-right text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ tierGroups[tier].reduce((s, o) => s + (o.projectCount || 0), 0) }}</td>
                <td v-if="selectedDays !== '0'" class="px-4 py-2.5 text-right">
                  <span
                    v-if="tierSummaries[tier].count > 0"
                    class="text-[11px] font-medium px-1.5 py-0.5 rounded-full"
                    :class="tierSummaries[tier].avgChange > 0
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                      : tierSummaries[tier].avgChange < 0
                        ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                        : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50'"
                  >
                    {{ tierSummaries[tier].avgChange > 0 ? '↑' : tierSummaries[tier].avgChange < 0 ? '↓' : '→' }}{{ Math.abs(tierSummaries[tier].avgChange).toFixed(1) }}% avg
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, inject } from 'vue'
import {
  Target as TargetIcon,
  Crown as CrownIcon,
  Shield as ShieldIcon,
} from 'lucide-vue-next'
import { apiRequest } from '@shared/client/services/api'
import { StatCardSkeleton, TableRowSkeleton } from '../components/SkeletonLoaders.vue'
import StickyPageHeader from '../components/StickyPageHeader.vue'
import {
  getStrategicTier, TIER_CONFIG,
  getStrategicLabel, getStrategicBadgeClass,
} from '../composables/useStrategicClassification.js'

const nav = inject('moduleNav')
const MODULE_API = '/modules/upstream-pulse'

const tierOrder = ['increasing', 'sustaining', 'evaluating']

const selectedDays = ref('30')
const selectedTier = ref(null)
const loading = ref(true)
const error = ref(null)
const orgs = ref([])

const strategicOrgs = computed(() =>
  orgs.value.filter(o => getStrategicTier(o) !== null)
)

const tierGroups = computed(() => {
  const groups = { increasing: [], sustaining: [], evaluating: [] }
  for (const org of strategicOrgs.value) {
    const tier = getStrategicTier(org)
    if (tier) groups[tier].push(org)
  }
  for (const tier of tierOrder) {
    groups[tier].sort((a, b) => (b.contributionCount || 0) - (a.contributionCount || 0))
  }
  return groups
})

const tierSummaries = computed(() => {
  const result = {}
  for (const tier of tierOrder) {
    const group = tierGroups.value[tier]
    const contributions = group.reduce((sum, o) => sum + (o.contributionCount || 0), 0)
    const leaders = group.reduce((sum, o) => sum + (o.leadershipCount || 0), 0)
    const maintainers = group.reduce((sum, o) => sum + (o.maintainerCount || 0), 0)
    const changes = group.filter(o => o.percentChange != null).map(o => o.percentChange)
    const avgChange = changes.length > 0 ? changes.reduce((s, v) => s + v, 0) / changes.length : 0
    result[tier] = { count: group.length, contributions, leaders, maintainers, avgChange }
  }
  return result
})

const visibleTiers = computed(() => {
  if (selectedTier.value) return [selectedTier.value]
  return tierOrder.filter(t => tierGroups.value[t].length > 0)
})

function toggleTier(tier) {
  selectedTier.value = selectedTier.value === tier ? null : tier
}

const statStrip = computed(() => {
  const active = selectedTier.value
    ? tierGroups.value[selectedTier.value]
    : strategicOrgs.value
  const contributions = active.reduce((sum, o) => sum + (o.contributionCount || 0), 0)
  const leaders = active.reduce((sum, o) => sum + (o.leadershipCount || 0), 0)
  const avgShare = active.length > 0
    ? (active.reduce((sum, o) => sum + (o.teamSharePercent || 0), 0) / active.length).toFixed(1)
    : '0.0'
  return { communities: active.length, contributions, avgShare, leaders }
})

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const orgsData = await apiRequest(`${MODULE_API}/orgs?days=${selectedDays.value}`)
    orgs.value = orgsData.orgs || []
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

watch(selectedDays, () => loadData())
onMounted(() => loadData())
</script>
