<script setup>
import { reactive, computed } from 'vue'
import SizeIndicator from './SizeIndicator.vue'

var props = defineProps({
  bigRocks: { type: Array, default: () => [] },
  jiraBaseUrl: { type: String, default: '' },
  canEdit: { type: Boolean, default: false },
  canAdd: { type: Boolean, default: false },
  canDelete: { type: Boolean, default: false },
  canReorder: { type: Boolean, default: false },
  rockHealth: { type: Object, default: () => ({}) },
  rockFeatures: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  healthLoading: { type: Boolean, default: false },
  releasePhaseMode: { type: String, default: 'unknown' },
  exportMenuOpen: { type: Boolean, default: false }
})

var emit = defineEmits(['editRock', 'addRock', 'deleteRock', 'reorder', 'toggleExport', 'closeExport', 'exportMarkdown', 'exportCsv'])

// Drill-down state
var expandedRocks = reactive({})
var expandedOutcomes = reactive({})

var isPlanningMode = computed(function() {
  return props.releasePhaseMode === 'planning'
})

// ── Constants ──

var BORDER_CLASS = {
  green: 'border-l-green-500',
  yellow: 'border-l-yellow-500',
  red: 'border-l-red-500'
}

var DOT_CLASS = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500'
}

var RELEASE_TYPE_STYLES = {
  DP: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',
  TP: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
  GA: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
}

var PLANNING_STATUS_LABELS = {
  'not-ready': 'Not Ready',
  'in-planning': 'In Planning',
  'ready-for-execution': 'Ready'
}

var PLANNING_STATUS_CLASSES = {
  'not-ready': 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  'in-planning': 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  'ready-for-execution': 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
}

function releaseTypeBadgeClass(rt) {
  return RELEASE_TYPE_STYLES[rt] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
}

function completionBarColor(pct) {
  if (pct >= 80) return 'bg-green-500'
  if (pct >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

// ── Computed ──

var sortedRocks = computed(function() {
  return props.bigRocks.slice().sort(function(a, b) {
    return (a.priority || 999) - (b.priority || 999)
  })
})

// ── State helpers ──

function toggleRock(rockName) {
  if (expandedRocks[rockName]) {
    delete expandedRocks[rockName]
  } else {
    expandedRocks[rockName] = true
  }
}

function toggleOutcome(outcomeKey) {
  if (expandedOutcomes[outcomeKey]) {
    delete expandedOutcomes[outcomeKey]
  } else {
    expandedOutcomes[outcomeKey] = true
  }
}

function expandAll() {
  for (var i = 0; i < sortedRocks.value.length; i++) {
    var rock = sortedRocks.value[i]
    expandedRocks[rock.name] = true
    if (rock.outcomeKeys) {
      for (var j = 0; j < rock.outcomeKeys.length; j++) {
        expandedOutcomes[rock.outcomeKeys[j]] = true
      }
    }
  }
}

function collapseAll() {
  var keys = Object.keys(expandedRocks)
  for (var i = 0; i < keys.length; i++) delete expandedRocks[keys[i]]
  var oKeys = Object.keys(expandedOutcomes)
  for (var i = 0; i < oKeys.length; i++) delete expandedOutcomes[oKeys[i]]
}

// ── Data accessors ──

function truncate(text, max) {
  if (!text) return ''
  return text.length > max ? text.slice(0, max) + '...' : text
}

function rockLevel(rockName) {
  var rh = props.rockHealth[rockName]
  return rh ? rh.worstLevel || 'green' : 'green'
}

function getHealth(rockName) {
  return props.rockHealth[rockName] || null
}

function healthBadgeClass(rockName) {
  var h = getHealth(rockName)
  if (!h) return ''
  if (isPlanningMode.value && h.planningTotal > 0) {
    if (h.planningBlockers > 0) return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
    return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
  }
  var level = h.worstLevel
  if (level === 'red') return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
  if (level === 'yellow') return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
  return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
}

function healthLabel(rockName) {
  var h = getHealth(rockName)
  if (!h) return '-'
  if (isPlanningMode.value && h.planningTotal > 0) {
    return h.planningReady + '/' + h.planningTotal + ' ready'
  }
  var level = h.worstLevel
  if (level === 'green') return 'OK'
  if (level === 'yellow') return 'At Risk'
  return 'Critical'
}

function planningProgressPct(rockName) {
  var h = getHealth(rockName)
  if (!h || !h.planningTotal) return 0
  return Math.round((h.planningReady / h.planningTotal) * 100)
}

function outcomeUrl(key) {
  if (!props.jiraBaseUrl || !key) return ''
  var base = props.jiraBaseUrl.replace(/\/browse\/?$/, '')
  return base + '/browse/' + key
}

function childClass(idx, total) {
  if (total === 1) return 'wg-child-only'
  if (idx === 0) return 'wg-child-first'
  if (idx === total - 1) return 'wg-child-last'
  return ''
}
</script>

<template>
  <div class="space-y-3">
    <!-- Toolbar -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <button
          @click="expandAll"
          class="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
        >Expand All</button>
        <button
          @click="collapseAll"
          class="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
        >Collapse All</button>
      </div>
      <button
        v-if="canAdd"
        @click="emit('addRock')"
        class="px-3 py-1.5 text-xs font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700"
      >+ Add Rock</button>
    </div>

    <!-- Loading -->
    <div v-if="loading && bigRocks.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">Loading...</div>

    <!-- Empty -->
    <div v-else-if="bigRocks.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">No big rocks found.</div>

    <!-- Horizontal work graph -->
    <div v-else class="overflow-x-auto pb-4">
      <div class="wg">
        <div v-for="rock in sortedRocks" :key="rock.name" class="wg-row">

          <!-- ── Level 1: Rock node ── -->
          <div
            :class="['wg-node wg-rock', BORDER_CLASS[rockLevel(rock.name)] || 'border-l-gray-300']"
            @click="toggleRock(rock.name)"
          >
            <!-- Row 1: Priority + Name + Chevron -->
            <div class="flex items-center gap-2">
              <span class="font-mono text-xs text-gray-400 dark:text-gray-500 w-5 text-right flex-shrink-0">{{ rock.priority }}</span>
              <span :class="['w-2.5 h-2.5 rounded-full flex-shrink-0', DOT_CLASS[rockLevel(rock.name)]]"></span>
              <span class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ rock.name }}</span>
              <svg :class="['w-3.5 h-3.5 text-gray-400 transition-transform ml-auto flex-shrink-0', expandedRocks[rock.name] ? 'rotate-90' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            </div>

            <!-- Row 2: Pillar + Health badge -->
            <div class="flex items-center gap-2 mt-1.5 ml-7">
              <span class="text-[10px] text-gray-500 dark:text-gray-400">{{ rock.pillar || 'Unassigned' }}</span>
              <span v-if="getHealth(rock.name)" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold" :class="healthBadgeClass(rock.name)">
                {{ healthLabel(rock.name) }}
              </span>
            </div>

            <!-- Row 2b: Planning progress bar (planning mode only) -->
            <div v-if="isPlanningMode && getHealth(rock.name) && getHealth(rock.name).planningTotal > 0" class="ml-7 mt-1">
              <div class="w-20 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all"
                  :class="getHealth(rock.name).planningBlockers > 0 ? 'bg-red-500' : 'bg-green-500'"
                  :style="{ width: planningProgressPct(rock.name) + '%' }"
                />
              </div>
            </div>

            <!-- Row 3: Owners -->
            <div class="mt-1.5 ml-7 space-y-0.5">
              <div class="flex items-center gap-1">
                <span class="text-[9px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">PM</span>
                <span class="text-[11px] text-gray-600 dark:text-gray-300">{{ rock.owner || '-' }}</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="text-[9px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Eng</span>
                <span class="text-[11px] text-gray-600 dark:text-gray-300">{{ rock.architect || '-' }}</span>
              </div>
            </div>

            <!-- Row 4: Release types -->
            <div v-if="getHealth(rock.name) && getHealth(rock.name).releaseTypes && getHealth(rock.name).releaseTypes.length > 0" class="flex items-center gap-1 mt-1.5 ml-7">
              <span
                v-for="rt in getHealth(rock.name).releaseTypes"
                :key="rt"
                class="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold"
                :class="releaseTypeBadgeClass(rt)"
              >{{ rt }}</span>
            </div>

            <!-- Row 5: Version summary -->
            <div v-if="getHealth(rock.name)" class="mt-1.5 ml-7">
              <span class="text-[10px]" :class="getHealth(rock.name).missingVersionCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'">
                {{ getHealth(rock.name).versionedCount || 0 }} versioned<span v-if="getHealth(rock.name).missingVersionCount > 0">, {{ getHealth(rock.name).missingVersionCount }} missing</span>
              </span>
            </div>

            <!-- Row 6: Counts -->
            <div class="flex items-center gap-2 mt-1.5 ml-7">
              <span class="text-[10px] text-gray-500 dark:text-gray-400">
                <span class="font-semibold text-gray-700 dark:text-gray-300">{{ rock.featureCount || 0 }}</span> feat.
              </span>
              <span class="text-gray-300 dark:text-gray-600">|</span>
              <span class="text-[10px] text-gray-500 dark:text-gray-400">
                <span class="font-semibold text-gray-700 dark:text-gray-300">{{ rock.rfeCount || 0 }}</span> RFEs
              </span>
            </div>

            <!-- Row 7: Outcomes count preview -->
            <div v-if="rock.outcomeKeys && rock.outcomeKeys.length > 0" class="mt-1 ml-7">
              <span class="text-[10px] text-gray-400 dark:text-gray-500 italic">{{ rock.outcomeKeys.length }} outcome{{ rock.outcomeKeys.length !== 1 ? 's' : '' }}</span>
            </div>

            <!-- Actions -->
            <div v-if="canEdit || canDelete" class="flex gap-1 mt-2 ml-7 border-t border-gray-100 dark:border-gray-700 pt-1.5">
              <button v-if="canEdit" @click.stop="emit('editRock', rock)" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Edit">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
              <button v-if="canDelete" @click.stop="emit('deleteRock', rock)" class="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Delete">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>

          <!-- ── Connector: Rock -> Outcomes ── -->
          <template v-if="expandedRocks[rock.name]">
            <div class="wg-line"></div>

            <!-- ── Level 2: Outcomes ── -->
            <div class="wg-children">
              <template v-if="rock.outcomeKeys && rock.outcomeKeys.length > 0">
                <div v-for="(oKey, oi) in rock.outcomeKeys" :key="oKey" :class="['wg-child', childClass(oi, rock.outcomeKeys.length)]">
                  <div class="wg-node wg-outcome" @click="toggleOutcome(oKey)">
                    <div class="flex items-center gap-1.5">
                      <a :href="outcomeUrl(oKey)" target="_blank" rel="noopener" class="font-mono text-[11px] text-primary-600 dark:text-primary-400 hover:underline" @click.stop>{{ oKey }}</a>
                      <svg :class="['w-3 h-3 text-gray-400 transition-transform ml-auto flex-shrink-0', expandedOutcomes[oKey] ? 'rotate-90' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                    </div>
                    <div v-if="rock.outcomeDescriptions && rock.outcomeDescriptions[oKey]" class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[180px]">
                      {{ truncate(rock.outcomeDescriptions[oKey], 50) }}
                    </div>
                  </div>

                  <!-- ── Connector: Outcome -> Features ── -->
                  <template v-if="expandedOutcomes[oKey] && rockFeatures[rock.name] && rockFeatures[rock.name].length > 0">
                    <div class="wg-line"></div>

                    <!-- ── Level 3: Features ── -->
                    <div class="wg-children">
                      <div
                        v-for="(feat, fi) in rockFeatures[rock.name]"
                        :key="feat.key"
                        :class="['wg-child', childClass(fi, rockFeatures[rock.name].length)]"
                      >
                        <div :class="['wg-node wg-feature', BORDER_CLASS[feat.level] || 'border-l-gray-300']">
                          <!-- Feature Row 1: Key + risk dot + badges -->
                          <div class="flex items-center gap-1.5">
                            <span :class="['w-2 h-2 rounded-full flex-shrink-0', DOT_CLASS[feat.level] || 'bg-gray-300']"></span>
                            <a v-if="feat.jiraUrl" :href="feat.jiraUrl" target="_blank" rel="noopener" class="font-mono text-[11px] text-primary-600 dark:text-primary-400 hover:underline" @click.stop>{{ feat.key }}</a>
                            <span v-else class="font-mono text-[11px] text-gray-500">{{ feat.key }}</span>
                            <span v-if="feat.override" class="text-[9px] font-medium text-amber-600 dark:text-amber-400" title="Risk level manually overridden">M</span>
                            <span v-if="feat.bigRock && feat.bigRock.includes(', ')" class="text-[9px] font-medium text-indigo-600 dark:text-indigo-400" :title="'Shared across: ' + feat.bigRock">S</span>
                          </div>

                          <!-- Feature Row 2: Summary -->
                          <div class="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5 truncate max-w-[230px]" :title="feat.summary">{{ truncate(feat.summary, 60) }}</div>

                          <!-- Feature Row 3: Owner -->
                          <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                            <span class="text-[9px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Owner</span>
                            <span class="ml-1">{{ feat.deliveryOwner || '-' }}</span>
                          </div>

                          <!-- Feature Row 4: Status -->
                          <div class="mt-1">
                            <!-- Planning mode: status badge + checks -->
                            <template v-if="isPlanningMode">
                              <span
                                v-if="feat.planningStatus"
                                class="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold"
                                :class="PLANNING_STATUS_CLASSES[feat.planningStatus] || ''"
                              >{{ PLANNING_STATUS_LABELS[feat.planningStatus] || feat.planningStatus }}</span>
                              <span v-if="feat.planningChecks" class="ml-1 text-[9px] text-gray-500 dark:text-gray-400">
                                {{ feat.planningChecks.passedCount }}/{{ feat.planningChecks.totalCount }}
                              </span>
                            </template>
                            <!-- Execution mode: completion bar -->
                            <template v-else>
                              <div class="inline-flex items-center gap-1.5">
                                <div class="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div class="h-full rounded-full" :style="{ width: (feat.completionPct || 0) + '%' }" :class="completionBarColor(feat.completionPct || 0)" />
                                </div>
                                <span class="text-[10px] font-semibold text-gray-600 dark:text-gray-400">{{ feat.completionPct || 0 }}%</span>
                              </div>
                            </template>
                          </div>

                          <!-- Feature Row 5: Release type + target + fix versions -->
                          <div class="flex flex-wrap items-center gap-1 mt-1">
                            <span
                              v-if="feat.releaseType && ['DP','TP','GA'].indexOf(feat.releaseType) !== -1"
                              class="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold"
                              :class="releaseTypeBadgeClass(feat.releaseType)"
                            >{{ feat.releaseType }}</span>
                            <span
                              v-if="feat.targetRelease"
                              class="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                            >{{ feat.targetRelease }}</span>
                          </div>

                          <!-- Feature Row 6: Fix versions -->
                          <div class="mt-1">
                            <div v-if="feat.fixVersions" class="flex flex-wrap gap-0.5">
                              <span
                                v-for="fv in feat.fixVersions.split(', ').filter(Boolean)"
                                :key="fv"
                                class="inline-block px-1 py-0.5 rounded text-[9px] font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                              >{{ fv }}</span>
                            </div>
                            <span v-else class="inline-flex items-center gap-0.5 text-amber-500 dark:text-amber-400 text-[9px]">
                              <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              no version
                            </span>
                          </div>

                          <!-- Feature Row 7: Size indicator -->
                          <div v-if="(feat.epicCount || 0) + (feat.issueCount || 0) > 0" class="mt-1.5 border-t border-gray-100 dark:border-gray-700 pt-1">
                            <SizeIndicator
                              :epicCount="feat.epicCount || 0"
                              :issueCount="feat.issueCount || 0"
                              :rice="feat.rice"
                              :storyPoints="feat.storyPoints"
                              :completionPct="feat.completionPct || 0"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>

                  <!-- No features -->
                  <template v-else-if="expandedOutcomes[oKey] && (!rockFeatures[rock.name] || rockFeatures[rock.name].length === 0)">
                    <div class="wg-line"></div>
                    <div class="wg-node wg-empty">No features linked</div>
                  </template>
                </div>
              </template>

              <!-- Rock has no outcomes -->
              <div v-else class="wg-child wg-child-only">
                <div class="wg-node wg-empty">No outcomes configured</div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Work Graph layout ── */
.wg {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 8px;
  min-width: fit-content;
}

.wg-row {
  display: flex;
  align-items: center;
}

/* ── Nodes ── */
.wg-node {
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgb(229, 231, 235);
  background: white;
  flex-shrink: 0;
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.wg-node:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  border-color: rgb(199, 210, 254);
}

.wg-rock {
  width: 280px;
  min-width: 280px;
  border-left-width: 4px;
  border-left-style: solid;
}

.wg-outcome {
  width: 210px;
  min-width: 210px;
  border-color: rgb(199, 210, 254);
  background: rgb(238, 242, 255);
}

.wg-outcome:hover {
  background: rgb(224, 231, 255);
}

.wg-feature {
  width: 260px;
  min-width: 260px;
  border-left-width: 3px;
  border-left-style: solid;
}

.wg-empty {
  padding: 8px 14px;
  font-size: 11px;
  color: rgb(156, 163, 175);
  font-style: italic;
  cursor: default;
  border-style: dashed;
}

.wg-empty:hover {
  box-shadow: none;
  border-color: rgb(229, 231, 235);
}

/* Dark mode */
:root.dark .wg-node {
  background: rgb(31, 41, 55);
  border-color: rgb(75, 85, 99);
}

:root.dark .wg-node:hover {
  border-color: rgba(99, 102, 241, 0.5);
}

:root.dark .wg-outcome {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.3);
}

:root.dark .wg-outcome:hover {
  background: rgba(99, 102, 241, 0.15);
}

@media (prefers-color-scheme: dark) {
  .wg-node {
    background: rgb(31, 41, 55);
    border-color: rgb(75, 85, 99);
  }
  .wg-node:hover {
    border-color: rgba(99, 102, 241, 0.5);
  }
  .wg-outcome {
    background: rgba(99, 102, 241, 0.1);
    border-color: rgba(99, 102, 241, 0.3);
  }
  .wg-outcome:hover {
    background: rgba(99, 102, 241, 0.15);
  }
}

/* ── Horizontal connector line ── */
.wg-line {
  width: 32px;
  min-width: 32px;
  height: 2px;
  background: rgb(209, 213, 219);
  flex-shrink: 0;
  margin: 0 -2px; /* overlap with adjacent card borders for seamless connection */
}

:root.dark .wg-line,
:root.dark .wg-child::before,
:root.dark .wg-child::after {
  background: rgb(75, 85, 99) !important;
}

@media (prefers-color-scheme: dark) {
  .wg-line,
  .wg-child::before,
  .wg-child::after {
    background: rgb(75, 85, 99) !important;
  }
}

/* ── Children column (vertical stack with connectors) ── */
.wg-children {
  display: flex;
  flex-direction: column;
}

.wg-child {
  display: flex;
  align-items: center;
  position: relative;
  padding-left: 20px;
  padding-top: 4px;
  padding-bottom: 4px;
}

/* Horizontal stub from vertical spine to child node */
.wg-child::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 20px;
  height: 2px;
  background: rgb(209, 213, 219);
}

/* Vertical spine connecting siblings */
.wg-child::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgb(209, 213, 219);
}

/* First child: spine starts at center */
.wg-child-first::after { top: 50%; }

/* Last child: spine ends at center */
.wg-child-last::after { bottom: 50%; }

/* Only child: no vertical spine */
.wg-child-only::after { display: none; }
</style>
