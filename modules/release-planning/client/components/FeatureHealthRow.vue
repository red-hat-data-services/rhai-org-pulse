<script setup>
import { computed } from 'vue'
import RiceScoreDisplay from './RiceScoreDisplay.vue'
import DorChecklist from './DorChecklist.vue'
import StatusBadge from './StatusBadge.vue'

const props = defineProps({
  feature: { type: Object, required: true },
  expanded: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: false },
  jiraBaseUrl: { type: String, default: '' }
})

const emit = defineEmits(['toggle', 'toggleDorItem', 'updateNotes', 'setOverride', 'removeOverride'])

var dorItems = computed(function() {
  if (!props.feature.dor || !props.feature.dor.items) return []
  return props.feature.dor.items
})

var dorNotes = computed(function() {
  if (!props.feature.dor) return ''
  return props.feature.dor.notes || ''
})

var riskFlags = computed(function() {
  if (!props.feature.risk || !props.feature.risk.flags) return []
  return props.feature.risk.flags
})

var riskLevel = computed(function() {
  if (!props.feature.risk) return 'green'
  return props.feature.risk.level || 'green'
})

var riskOverride = computed(function() {
  if (!props.feature.risk) return null
  return props.feature.risk.override || null
})

var effectiveRisk = computed(function() {
  if (riskOverride.value) return riskOverride.value.riskOverride || riskLevel.value
  return riskLevel.value
})

var dorPct = computed(function() {
  if (!props.feature.dor) return 0
  return props.feature.dor.completionPct || 0
})

var dorPctClass = computed(function() {
  if (dorPct.value >= 80) return 'text-green-600 dark:text-green-400'
  if (dorPct.value >= 50) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
})

var healthTooltip = computed(function() {
  var lines = []
  lines.push('Risk: ' + effectiveRisk.value.charAt(0).toUpperCase() + effectiveRisk.value.slice(1))
  var dor = props.feature.dor
  lines.push('DoR: ' + dorPct.value + '% (' + (dor ? dor.checkedCount : 0) + '/' + (dor ? dor.totalCount : 0) + ')')
  if (riskFlags.value.length > 0) {
    lines.push(riskFlags.value.length + ' risk flag(s):')
    for (var i = 0; i < riskFlags.value.length; i++) {
      lines.push('  - ' + riskFlags.value[i].category + ': ' + riskFlags.value[i].message)
    }
  }
  if (riskOverride.value) {
    lines.push('Override: ' + riskOverride.value.riskOverride + ' (' + riskOverride.value.reason + ')')
  }
  return lines.join('\n')
})

var priorityScoreClass = computed(function() {
  var score = props.feature.priorityScore
  if (score >= 70) return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
  if (score >= 40) return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
  return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
})

var priorityTooltip = computed(function() {
  if (!props.feature.priorityBreakdown) return ''
  var b = props.feature.priorityBreakdown
  return 'RICE: ' + b.rice + '% (30w)\n' +
         'Big Rock: ' + b.bigRock + '% (30w)\n' +
         'Priority: ' + b.priority + '% (25w)\n' +
         'Complexity: ' + b.complexity + '% (15w)'
})

var featureUrl = computed(function() {
  if (props.feature.jiraUrl) return props.feature.jiraUrl
  if (props.jiraBaseUrl && props.feature.key) return props.jiraBaseUrl + '/' + props.feature.key
  return ''
})

function handleToggle() {
  emit('toggle', props.feature.key)
}

function handleDorToggle(itemId, checked) {
  emit('toggleDorItem', props.feature.key, itemId, checked)
}

function handleNotesUpdate(notes) {
  emit('updateNotes', props.feature.key, notes)
}

var flagSeverityClass = {
  high: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30',
  medium: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30'
}
</script>

<template>
  <!-- Main row -->
  <tr
    class="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
    @click="handleToggle"
  >
    <!-- Expand toggle -->
    <td class="px-2 py-2 border border-gray-300 dark:border-gray-600 w-8 text-center">
      <svg
        class="w-3.5 h-3.5 text-gray-400 transition-transform inline-block"
        :class="expanded ? 'rotate-90' : ''"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </td>
    <!-- Feature key -->
    <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
      <div class="flex items-center gap-1">
        <a
          v-if="featureUrl"
          :href="featureUrl"
          target="_blank"
          rel="noopener"
          class="text-primary-600 dark:text-blue-400 font-mono text-xs hover:underline"
          @click.stop
        >{{ feature.key }}</a>
        <span v-else class="font-mono text-xs text-gray-700 dark:text-gray-300">{{ feature.key }}</span>
        <a
          :href="'#/feature-traffic/feature-detail?key=' + encodeURIComponent(feature.key)"
          class="text-gray-400 hover:text-primary-600 dark:hover:text-blue-400"
          title="View in Feature Traffic"
          @click.stop
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </td>
    <!-- Summary -->
    <td class="px-3 py-2 text-gray-900 dark:text-gray-100 max-w-[200px] truncate border border-gray-300 dark:border-gray-600 text-xs">{{ feature.summary }}</td>
    <!-- Status -->
    <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
      <StatusBadge :status="feature.status" />
    </td>
    <!-- Health (combined Risk + DoR) -->
    <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
      <div class="flex items-center gap-1.5" :title="healthTooltip">
        <span
          class="w-2.5 h-2.5 rounded-full flex-shrink-0"
          role="img"
          :aria-label="'Risk level: ' + effectiveRisk"
          :class="{
            'bg-green-500': effectiveRisk === 'green',
            'bg-yellow-500': effectiveRisk === 'yellow',
            'bg-red-500': effectiveRisk === 'red'
          }"
        ></span>
        <span
          class="text-xs font-medium"
          :class="dorPctClass"
        >{{ dorPct }}%</span>
      </div>
    </td>
    <!-- Priority -->
    <td class="px-3 py-2 border border-gray-300 dark:border-gray-600 text-center" :title="priorityTooltip">
      <span
        v-if="feature.priorityScore != null"
        class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
        :class="priorityScoreClass"
      >{{ feature.priorityScore }}</span>
      <span v-else class="text-gray-400 dark:text-gray-600 text-xs">-</span>
    </td>
    <!-- RICE -->
    <td class="px-3 py-2 border border-gray-300 dark:border-gray-600 text-center" @click.stop>
      <RiceScoreDisplay :rice="feature.rice" :jiraUrl="featureUrl" />
    </td>
    <!-- Component -->
    <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">{{ feature.components || '-' }}</td>
    <!-- Owner -->
    <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">{{ feature.deliveryOwner || '-' }}</td>
    <!-- Phase -->
    <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
      <span
        v-if="feature.phase"
        class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
        :class="{
          'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400': feature.phase === 'TP' || feature.phase === 'EA1',
          'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400': feature.phase === 'DP' || feature.phase === 'EA2',
          'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400': feature.phase === 'GA'
        }"
      >{{ feature.phase }}</span>
      <span v-else class="text-gray-400 dark:text-gray-600 text-xs">-</span>
    </td>
    <!-- Tier -->
    <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">{{ feature.tier || '-' }}</td>
  </tr>

  <!-- Expanded detail row -->
  <tr v-if="expanded">
    <td colspan="11" class="border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-0">
      <div class="p-4 space-y-4">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- DoR Checklist -->
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <DorChecklist
              :items="dorItems"
              :notes="dorNotes"
              :featureKey="feature.key"
              :canEdit="canEdit"
              @toggleItem="handleDorToggle"
              @updateNotes="handleNotesUpdate"
            />
          </div>

          <!-- Risk Flags & Details -->
          <div class="space-y-3">
            <!-- Risk flags -->
            <div v-if="riskFlags.length > 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Risk Flags</div>
              <div class="space-y-1.5">
                <div
                  v-for="(flag, idx) in riskFlags"
                  :key="idx"
                  class="flex items-start gap-2 text-xs px-2 py-1.5 rounded border"
                  :class="flagSeverityClass[flag.severity] || flagSeverityClass.medium"
                >
                  <svg
                    class="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <span class="font-semibold">{{ flag.category }}</span>
                    <span class="ml-1">{{ flag.message }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Override section -->
            <div v-if="riskOverride" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Risk Override</div>
              <div class="text-xs text-gray-600 dark:text-gray-400">
                <span class="font-medium">Level:</span> {{ riskOverride.riskOverride }}
              </div>
              <div class="text-xs text-gray-600 dark:text-gray-400">
                <span class="font-medium">Reason:</span> {{ riskOverride.reason }}
              </div>
              <div class="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                Set by {{ riskOverride.updatedBy }} on {{ riskOverride.updatedAt ? new Date(riskOverride.updatedAt).toLocaleDateString() : '' }}
              </div>
              <button
                v-if="canEdit"
                @click.stop="$emit('removeOverride', feature.key)"
                class="mt-2 text-[10px] text-red-600 dark:text-red-400 hover:underline"
              >Remove override</button>
            </div>

            <!-- Feature metadata -->
            <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Feature Details</div>
              <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div>
                  <span class="text-gray-500 dark:text-gray-400">PM:</span>
                  <span class="ml-1 text-gray-900 dark:text-gray-100">{{ feature.pm || '-' }}</span>
                </div>
                <div>
                  <span class="text-gray-500 dark:text-gray-400">Owner:</span>
                  <span class="ml-1 text-gray-900 dark:text-gray-100">{{ feature.deliveryOwner || '-' }}</span>
                </div>
                <div>
                  <span class="text-gray-500 dark:text-gray-400">Epics:</span>
                  <span class="ml-1 text-gray-900 dark:text-gray-100">{{ feature.epicCount != null ? feature.epicCount : '-' }}</span>
                </div>
                <div>
                  <span class="text-gray-500 dark:text-gray-400">Issues:</span>
                  <span class="ml-1 text-gray-900 dark:text-gray-100">{{ feature.issueCount != null ? feature.issueCount : '-' }}</span>
                </div>
                <div>
                  <span class="text-gray-500 dark:text-gray-400">Completion:</span>
                  <span class="ml-1 text-gray-900 dark:text-gray-100">{{ feature.completionPct != null ? feature.completionPct + '%' : '-' }}</span>
                </div>
                <div>
                  <span class="text-gray-500 dark:text-gray-400">Blockers:</span>
                  <span
                    class="ml-1"
                    :class="feature.blockerCount > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-900 dark:text-gray-100'"
                  >{{ feature.blockerCount != null ? feature.blockerCount : '-' }}</span>
                </div>
                <div v-if="feature.bigRock">
                  <span class="text-gray-500 dark:text-gray-400">Big Rock:</span>
                  <a
                    :href="'#/release-planning/main?bigRock=' + encodeURIComponent(feature.bigRock)"
                    class="ml-1 text-primary-600 dark:text-blue-400 hover:underline"
                    @click.stop
                  >{{ feature.bigRock }}</a>
                </div>
                <div v-if="feature.tier">
                  <span class="text-gray-500 dark:text-gray-400">Tier:</span>
                  <span class="ml-1 text-gray-900 dark:text-gray-100">{{ feature.tier }}</span>
                </div>
                <div v-if="feature.tshirtSize">
                  <span class="text-gray-500 dark:text-gray-400">Size:</span>
                  <span class="ml-1 text-gray-900 dark:text-gray-100">{{ feature.tshirtSize }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </td>
  </tr>
</template>
