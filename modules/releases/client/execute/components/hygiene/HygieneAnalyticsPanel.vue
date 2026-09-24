<script setup>
import { ref, computed } from 'vue'

var props = defineProps({
  features: { type: Array, default: function () { return [] } },
  collapsed: { type: Boolean, default: true }
})

var emit = defineEmits(['update:collapsed'])

var activeTab = ref('accountability')

var categoryColors = {
  ownership: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  timeliness: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  metadata: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  lifecycle: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
}

var tabs = [
  { id: 'accountability', label: 'Team Accountability' },
  { id: 'versions', label: 'Cross-Version' }
]

// ── Aggregated totals ──

var totals = computed(function () {
  var totalFeatures = 0
  var featuresWithViolations = 0
  var totalViolations = 0
  var violationsByRule = {}
  var violationsByTeam = {}

  var all = props.features
  for (var i = 0; i < all.length; i++) {
    var f = all[i]
    if (f.scopeChange === 'dropped') continue
    totalFeatures++
    var violations = Array.isArray(f.violations) ? f.violations : []
    var count = violations.length
    totalViolations += count
    if (count > 0) {
      featuresWithViolations++
      var team = f.team || 'Unassigned'
      violationsByTeam[team] = (violationsByTeam[team] || 0) + count
    }
    for (var vi = 0; vi < violations.length; vi++) {
      var v = violations[vi]
      var ruleId = typeof v === 'string' ? v : (v && v.id) || 'unknown'
      violationsByRule[ruleId] = (violationsByRule[ruleId] || 0) + 1
    }
  }

  return { totalFeatures: totalFeatures, featuresWithViolations: featuresWithViolations, totalViolations: totalViolations, violationsByRule: violationsByRule, violationsByTeam: violationsByTeam }
})

// ── Violations by rule ──

var sortedRuleViolations = computed(function () {
  var byRule = totals.value.violationsByRule
  return Object.keys(byRule).map(function (id) {
    var name = id
    var category = 'unknown'
    var all = props.features
    for (var i = 0; i < all.length; i++) {
      var violations = Array.isArray(all[i].violations) ? all[i].violations : []
      for (var vi = 0; vi < violations.length; vi++) {
        var v = violations[vi]
        if (v && typeof v === 'object' && v.id === id) {
          if (v.name) name = v.name
          if (v.category) category = v.category
          break
        }
      }
      if (name !== id) break
    }
    return { id: id, name: name, category: category, count: byRule[id] }
  }).sort(function (a, b) { return b.count - a.count })
})

var maxRuleCount = computed(function () {
  return sortedRuleViolations.value.length > 0 ? sortedRuleViolations.value[0].count : 1
})

// ── Violations by team ──

var sortedTeamViolations = computed(function () {
  var byTeam = totals.value.violationsByTeam
  return Object.keys(byTeam).map(function (team) {
    return { team: team, count: byTeam[team] }
  }).sort(function (a, b) { return b.count - a.count })
})

var maxTeamCount = computed(function () {
  return sortedTeamViolations.value.length > 0 ? sortedTeamViolations.value[0].count : 1
})

// ── Team accountability ──

var teamAccountability = computed(function () {
  var teamMap = {}
  var all = props.features
  for (var i = 0; i < all.length; i++) {
    var f = all[i]
    if (f.scopeChange === 'dropped') continue
    var team = f.team || 'Unassigned'
    if (!teamMap[team]) {
      teamMap[team] = { team: team, totalFeatures: 0, featuresWithViolations: 0, totalViolations: 0, byCategory: {} }
    }
    teamMap[team].totalFeatures++
    var violations = Array.isArray(f.violations) ? f.violations : []
    if (violations.length > 0) {
      teamMap[team].featuresWithViolations++
      teamMap[team].totalViolations += violations.length
    }
    for (var vi = 0; vi < violations.length; vi++) {
      var v = violations[vi]
      var cat = (typeof v === 'object' && v && v.category) ? v.category : 'unknown'
      teamMap[team].byCategory[cat] = (teamMap[team].byCategory[cat] || 0) + 1
    }
  }
  return Object.values(teamMap).sort(function (a, b) { return b.totalViolations - a.totalViolations })
})

// ── Cross-version summary ──

var crossVersionSummary = computed(function () {
  var versionMap = {}
  var all = props.features
  for (var i = 0; i < all.length; i++) {
    var f = all[i]
    if (f.scopeChange === 'dropped') continue
    var versions = Array.isArray(f.fixVersions) && f.fixVersions.length > 0
      ? f.fixVersions
      : (Array.isArray(f.targetVersions) && f.targetVersions.length > 0 ? f.targetVersions : ['No Version'])
    for (var vi = 0; vi < versions.length; vi++) {
      var ver = versions[vi]
      if (!versionMap[ver]) {
        versionMap[ver] = { version: ver, totalFeatures: 0, featuresWithViolations: 0, totalViolations: 0 }
      }
      versionMap[ver].totalFeatures++
      var violations = Array.isArray(f.violations) ? f.violations : []
      versionMap[ver].totalViolations += violations.length
      if (violations.length > 0) versionMap[ver].featuresWithViolations++
    }
  }
  return Object.values(versionMap).sort(function (a, b) { return b.totalViolations - a.totalViolations })
})

function toggle() {
  emit('update:collapsed', !props.collapsed)
}
</script>

<template>
  <div class="mb-4" data-testid="hygiene-analytics-panel">
    <!-- Toggle header -->
    <button
      type="button"
      class="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
      @click="toggle"
    >
      <div class="flex items-center gap-2">
        <svg
          class="w-4 h-4 text-gray-400 transition-transform"
          :class="{ '-rotate-90': collapsed }"
          fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
        <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">Program Hygiene</span>
      </div>
      <div class="flex items-center gap-3">
        <span
          v-if="totals.totalViolations > 0"
          class="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
        >{{ totals.totalViolations }} violation{{ totals.totalViolations !== 1 ? 's' : '' }}</span>
        <span
          v-else
          class="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
        >No violations</span>
        <span class="text-xs text-gray-400">{{ totals.totalFeatures }} features</span>
      </div>
    </button>

    <!-- Collapsible body -->
    <div v-if="!collapsed" class="mt-3 space-y-4">
      <!-- Summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Features</div>
          <div class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ totals.totalFeatures }}</div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">With Violations</div>
          <div class="text-xl font-bold" :class="totals.featuresWithViolations > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
            {{ totals.featuresWithViolations }}
          </div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Total Violations</div>
          <div class="text-xl font-bold" :class="totals.totalViolations > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'">
            {{ totals.totalViolations }}
          </div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">Teams Affected</div>
          <div class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ sortedTeamViolations.length }}</div>
        </div>
      </div>

      <!-- Two-column bar charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Violations by Rule -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 class="text-xs font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3">Violations by Rule</h3>
          <div v-if="sortedRuleViolations.length === 0" class="text-sm text-gray-400">No violations found.</div>
          <div v-else class="space-y-2">
            <div v-for="rule in sortedRuleViolations" :key="rule.id" class="flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5">
                  <span class="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{{ rule.name }}</span>
                  <span
                    class="px-1.5 py-0.5 text-[9px] font-medium rounded shrink-0"
                    :class="categoryColors[rule.category] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'"
                  >{{ rule.category }}</span>
                </div>
                <div class="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-red-500 dark:bg-red-400 rounded-full transition-all"
                    :style="{ width: (rule.count / maxRuleCount * 100) + '%' }"
                  />
                </div>
              </div>
              <span class="text-sm font-semibold text-gray-900 dark:text-gray-100 w-8 text-right shrink-0">{{ rule.count }}</span>
            </div>
          </div>
        </div>

        <!-- Violations by Team -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 class="text-xs font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3">Violations by Team</h3>
          <div v-if="sortedTeamViolations.length === 0" class="text-sm text-gray-400">No violations found.</div>
          <div v-else class="space-y-2">
            <div v-for="team in sortedTeamViolations" :key="team.team" class="flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <div class="text-xs font-medium text-gray-700 dark:text-gray-300 truncate mb-0.5">{{ team.team }}</div>
                <div class="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-orange-500 dark:bg-orange-400 rounded-full transition-all"
                    :style="{ width: (team.count / maxTeamCount * 100) + '%' }"
                  />
                </div>
              </div>
              <span class="text-sm font-semibold text-gray-900 dark:text-gray-100 w-8 text-right shrink-0">{{ team.count }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabbed detail section -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <!-- Tab bar -->
        <div class="border-b border-gray-200 dark:border-gray-700 px-4">
          <div class="flex gap-4">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              class="py-2 text-xs font-medium border-b-2 -mb-px transition-colors"
              :class="activeTab === tab.id
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
            >{{ tab.label }}</button>
          </div>
        </div>

        <!-- Tab: Team Accountability -->
        <div v-if="activeTab === 'accountability'">
          <div v-if="teamAccountability.length === 0" class="p-6 text-center text-sm text-gray-400">
            No features in scope.
          </div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-[11px] text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th class="px-4 py-2 font-medium">Team</th>
                  <th class="px-4 py-2 font-medium text-right">Features</th>
                  <th class="px-4 py-2 font-medium text-right">With Violations</th>
                  <th class="px-4 py-2 font-medium text-right">Total</th>
                  <th class="px-4 py-2 font-medium text-right">
                    <span class="px-1.5 py-0.5 rounded text-[9px]" :class="categoryColors.ownership">Ownership</span>
                  </th>
                  <th class="px-4 py-2 font-medium text-right">
                    <span class="px-1.5 py-0.5 rounded text-[9px]" :class="categoryColors.timeliness">Timeliness</span>
                  </th>
                  <th class="px-4 py-2 font-medium text-right">
                    <span class="px-1.5 py-0.5 rounded text-[9px]" :class="categoryColors.metadata">Metadata</span>
                  </th>
                  <th class="px-4 py-2 font-medium text-right">
                    <span class="px-1.5 py-0.5 rounded text-[9px]" :class="categoryColors.lifecycle">Lifecycle</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                <tr v-for="team in teamAccountability" :key="team.team" class="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td class="px-4 py-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{{ team.team }}</td>
                  <td class="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{{ team.totalFeatures }}</td>
                  <td class="px-4 py-2 text-right">
                    <span :class="team.featuresWithViolations > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-400'">
                      {{ team.featuresWithViolations }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-right">
                    <span :class="team.totalViolations > 0 ? 'text-orange-600 dark:text-orange-400 font-semibold' : 'text-gray-400'">
                      {{ team.totalViolations }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-right">
                    <span :class="(team.byCategory.ownership || 0) > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'">
                      {{ team.byCategory.ownership || 0 }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-right">
                    <span :class="(team.byCategory.timeliness || 0) > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-300 dark:text-gray-600'">
                      {{ team.byCategory.timeliness || 0 }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-right">
                    <span :class="(team.byCategory.metadata || 0) > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-gray-300 dark:text-gray-600'">
                      {{ team.byCategory.metadata || 0 }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-right">
                    <span :class="(team.byCategory.lifecycle || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-300 dark:text-gray-600'">
                      {{ team.byCategory.lifecycle || 0 }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="teamAccountability.length > 0" class="px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-[11px] text-gray-400">
            {{ teamAccountability.length }} team{{ teamAccountability.length !== 1 ? 's' : '' }}
          </div>
        </div>

        <!-- Tab: Cross-Version -->
        <div v-if="activeTab === 'versions'">
          <div v-if="crossVersionSummary.length === 0" class="p-6 text-center text-sm text-gray-400">
            No version data available.
          </div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-[11px] text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th class="px-4 py-2 font-medium">Version</th>
                  <th class="px-4 py-2 font-medium text-right">Features</th>
                  <th class="px-4 py-2 font-medium text-right">With Violations</th>
                  <th class="px-4 py-2 font-medium text-right">Total Violations</th>
                  <th class="px-4 py-2 font-medium text-right">Violation Rate</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                <tr v-for="ver in crossVersionSummary" :key="ver.version" class="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td class="px-4 py-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{{ ver.version }}</td>
                  <td class="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{{ ver.totalFeatures }}</td>
                  <td class="px-4 py-2 text-right">
                    <span :class="ver.featuresWithViolations > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-400'">
                      {{ ver.featuresWithViolations }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-right">
                    <span :class="ver.totalViolations > 0 ? 'text-orange-600 dark:text-orange-400 font-semibold' : 'text-gray-400'">
                      {{ ver.totalViolations }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-right">
                    <span
                      :class="ver.totalFeatures > 0 && ver.featuresWithViolations > 0
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-green-600 dark:text-green-400'"
                    >{{ ver.totalFeatures > 0 ? Math.round(ver.featuresWithViolations / ver.totalFeatures * 100) : 0 }}%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="crossVersionSummary.length > 0" class="px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-[11px] text-gray-400">
            {{ crossVersionSummary.length }} version{{ crossVersionSummary.length !== 1 ? 's' : '' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
