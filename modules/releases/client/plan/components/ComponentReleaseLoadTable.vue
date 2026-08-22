<script setup>
import { reactive, computed } from 'vue'
import { getComponentLeads } from '../../composables/componentLeads'
import FPDoRPopover from './FPDoRPopover.vue'
import AlignmentPopover from './AlignmentPopover.vue'
import AlignmentLegendPopover from './AlignmentLegendPopover.vue'
import { failedFpdorNames } from '../utils/feature-readiness-export.js'
import {
  fpdorItemSeverity,
  severityChipClass,
  severityLabel,
  pathLabel,
  pathChipClass,
  pathChipTitle
} from '../utils/fpdor-severity.js'
import {
  docsRequiredState,
  docsRequiredLabel,
  docsRequiredTitle,
  docsRequiredChipClass
} from '../utils/docs-required-display.js'
import {
  worseAlignmentCategory,
  isAlignedCategory,
  alignmentCategoryLabel,
  alignmentCategoryChipClass,
  ALIGNMENT_DISPLAY_KEYS
} from '../utils/tv-fv-alignment-display.js'
import { countAlignment, afterRequestedSplit } from '../utils/alignment-rollup.js'

const props = defineProps({
  groups: { type: Array, default: () => [] },
  componentLeads: { type: Object, default: () => ({}) },
  initialSort: { type: Object, default: () => ({ column: null, direction: 'asc' }) }
})

var emit = defineEmits(['sort-changed', 'select'])

const JIRA_BASE = 'https://redhat.atlassian.net/browse'
var MAX_VISIBLE_FAIL_CHIPS = 2

const COMP_STYLE = {
  border: 'border-l-primary-500',
  dot: 'bg-primary-500'
}

var expandedComponents = reactive({})

// ═══ SORT STATE ═══

var SORT_COLUMNS = ['key', 'summary', 'priority', 'releaseType', 'status', 'colorStatus', 'fixVersion', 'targetVersion', 'blocked', 'alignmentCategory', 'readiness', 'assignee', 'pmOwner', 'docs']

var PRIORITY_ORDER = { 'Blocker': 0, 'Critical': 1, 'Major': 2, 'Normal': 3 }
var COLOR_STATUS_ORDER = { 'red': 0, 'yellow': 1, 'green': 2 }
var ALIGNMENT_SORT_ORDER = {
  aligned_on_time: 0,
  aligned_late: 1,
  fv_only: 2,
  tv_only: 3,
  after_requested: 4,
  misaligned: 5
}

var sortState = reactive({
  column: SORT_COLUMNS.indexOf(props.initialSort.column) !== -1 ? props.initialSort.column : null,
  direction: props.initialSort.direction || 'asc'
})

function toggleSort(column) {
  if (SORT_COLUMNS.indexOf(column) === -1) return
  if (sortState.column === column) {
    if (sortState.direction === 'asc') {
      sortState.direction = 'desc'
    } else {
      sortState.column = null
      sortState.direction = 'asc'
    }
  } else {
    sortState.column = column
    sortState.direction = 'asc'
  }
  emit('sort-changed', { column: sortState.column, direction: sortState.direction })
}

function getSortValue(feature, column) {
  if (column === 'key') return feature.key || ''
  if (column === 'summary') return (feature.summary || '').toLowerCase()
  if (column === 'priority') {
    var po = PRIORITY_ORDER[feature.priority]
    return po !== undefined ? po : 99
  }
  if (column === 'releaseType') return (feature.releaseType || '').toLowerCase()
  if (column === 'status') return (feature.status || '').toLowerCase()
  if (column === 'colorStatus') {
    var co = COLOR_STATUS_ORDER[(feature.colorStatus || '').toLowerCase()]
    return co !== undefined ? co : 99
  }
  if (column === 'fixVersion') {
    return feature.fixVersions && feature.fixVersions.length > 0 ? feature.fixVersions[0] : ''
  }
  if (column === 'targetVersion') {
    return feature.targetVersions && feature.targetVersions.length > 0 ? feature.targetVersions[0] : ''
  }
  if (column === 'blocked') return feature.isBlocked ? 1 : 0
  if (column === 'alignmentCategory') {
    var ao = ALIGNMENT_SORT_ORDER[feature.alignmentCategory]
    return ao !== undefined ? ao : 99
  }
  if (column === 'readiness') {
    if (!feature.fpdor) return 99
    if (feature.fpdor.allApplicablePassed) return 0
    return 1
  }
  if (column === 'assignee') return (feature.assignee || '').toLowerCase()
  if (column === 'pmOwner') return (feature.pmOwner || '').toLowerCase()
  if (column === 'docs') {
    var docsState = docsRequiredState(feature)
    if (docsState === 'yes') return 0
    if (docsState === 'yes-missing-component') return 1
    if (docsState === 'no') return 2
    return 3
  }
  return ''
}

function sortFeatures(features) {
  if (!sortState.column) return features
  var col = sortState.column
  var dir = sortState.direction === 'asc' ? 1 : -1
  var sorted = features.slice()
  sorted.sort(function(a, b) {
    var va = getSortValue(a, col)
    var vb = getSortValue(b, col)
    if (va < vb) return -1 * dir
    if (va > vb) return 1 * dir
    return 0
  })
  return sorted
}

function sortIcon(column) {
  if (sortState.column !== column) return 'none'
  return sortState.direction
}

function visibleFailChips(feature) {
  return failedFpdorNames(feature).slice(0, MAX_VISIBLE_FAIL_CHIPS)
}

function overflowFailCount(feature) {
  return Math.max(0, failedFpdorNames(feature).length - MAX_VISIBLE_FAIL_CHIPS)
}

function chipClassForName(name) {
  return severityChipClass(fpdorItemSeverity(name))
}

function chipTitleForName(name) {
  return 'Failed FPDoR (' + severityLabel(fpdorItemSeverity(name)) + '): ' + name
}

function toggleComponent(component) {
  if (expandedComponents[component]) {
    delete expandedComponents[component]
  } else {
    expandedComponents[component] = true
  }
}

function isComponentExpanded(component) {
  return !!expandedComponents[component]
}

function expandAll() {
  var src = componentGroups.value
  for (var i = 0; i < src.length; i++) {
    expandedComponents[src[i].component] = true
  }
}

function collapseAll() {
  var src = componentGroups.value
  for (var i = 0; i < src.length; i++) {
    delete expandedComponents[src[i].component]
  }
}

function getLeads(componentName) {
  return getComponentLeads(props.componentLeads, componentName)
}

function extractProduct(versionName) {
  if (!versionName) return versionName
  var lower = versionName.toLowerCase()
  if (lower.indexOf('rhoai') !== -1) return 'RHOAI'
  if (lower.indexOf('rhelai') !== -1) return 'RHELAI'
  if (lower.indexOf('rhaii') !== -1) return 'RHAII'
  return null
}

var componentGroups = computed(function() {
  var compMap = {}

  for (var gi = 0; gi < props.groups.length; gi++) {
    var group = props.groups[gi]
    var version = group.version

    for (var ci = 0; ci < group.components.length; ci++) {
      var comp = group.components[ci]
      var cName = comp.component

      if (!compMap[cName]) {
        compMap[cName] = {
          component: cName,
          features: {}
        }
      }

      var cg = compMap[cName]

      var reqList = comp.requestedFeatures || []
      var comList = comp.committedFeatures || []

      var reqKeys = {}
      var comKeys = {}
      for (var ri = 0; ri < reqList.length; ri++) reqKeys[reqList[ri].key] = true
      for (var cmi = 0; cmi < comList.length; cmi++) comKeys[comList[cmi].key] = true

      var allFeatures = []
      var seen = {}
      var lists = [reqList, comList]
      for (var li = 0; li < lists.length; li++) {
        for (var fi = 0; fi < lists[li].length; fi++) {
          var f = lists[li][fi]
          if (!seen[f.key]) {
            seen[f.key] = true
            allFeatures.push(f)
          }
        }
      }

      for (var ai = 0; ai < allFeatures.length; ai++) {
        var feat = allFeatures[ai]
        var isReq = !!reqKeys[feat.key]
        var isCom = !!comKeys[feat.key]

        if (!cg.features[feat.key]) {
          cg.features[feat.key] = {
            key: feat.key,
            summary: feat.summary,
            title: feat.title || feat.summary || '',
            status: feat.status,
            colorStatus: feat.colorStatus,
            statusSummary: feat.statusSummary,
            releaseType: feat.releaseType,
            priority: feat.priority,
            isBlocked: feat.isBlocked,
            blockedBy: feat.blockedBy || [],
            alignmentCategory: feat.alignmentCategory || null,
            pmDoAligned: feat.alignmentCategory
              ? isAlignedCategory(feat.alignmentCategory)
              : !!feat.pmDoAligned,
            fpdor: feat.fpdor || null,
            confidence: feat.confidence || null,
            isAiFirst: !!feat.isAiFirst,
            labels: feat.labels || [],
            riceScore: feat.riceScore != null ? feat.riceScore : null,
            linkedRfeKey: feat.linkedRfeKey || null,
            components: feat.components,
            fixVersions: feat.fixVersions || [],
            targetVersions: feat.targetVersions || [],
            assignee: feat.assignee,
            pmOwner: feat.pmOwner,
            docsRequired: feat.docsRequired || null,
            products: [],
            versions: [],
            isRequested: false,
            isCommitted: false
          }
        }

        var entry = cg.features[feat.key]
        entry.alignmentCategory = worseAlignmentCategory(
          entry.alignmentCategory,
          feat.alignmentCategory || null
        )
        entry.pmDoAligned = entry.alignmentCategory
          ? isAlignedCategory(entry.alignmentCategory)
          : !!entry.pmDoAligned
        var product = extractProduct(version)
        if (entry.products.indexOf(product) === -1) {
          entry.products.push(product)
        }
        if (entry.versions.indexOf(version) === -1) {
          entry.versions.push(version)
        }
        if (isReq) entry.isRequested = true
        if (isCom) entry.isCommitted = true
      }
    }
  }

  var result = []
  var compNames = Object.keys(compMap).sort()
  for (var ni = 0; ni < compNames.length; ni++) {
    var cm = compMap[compNames[ni]]
    var featureList = Object.values(cm.features)
    if (featureList.length === 0) continue

    var reqCount = 0
    var comCount = 0
    var blkCount = 0
    for (var fli = 0; fli < featureList.length; fli++) {
      if (featureList[fli].isRequested) reqCount++
      if (featureList[fli].isCommitted) comCount++
      if (featureList[fli].isBlocked) blkCount++
    }

    result.push({
      component: cm.component,
      features: featureList,
      requestedCount: reqCount,
      committedCount: comCount,
      blockedCount: blkCount,
      alignmentCounts: countAlignment(featureList)
    })
  }

  return result
})

function colorStatusClass(colorStatus) {
  var s = (colorStatus || '').toLowerCase()
  if (s === 'green') return 'bg-emerald-500'
  if (s === 'yellow') return 'bg-amber-400'
  if (s === 'red') return 'bg-red-500'
  return 'bg-gray-300 dark:bg-gray-600'
}

function colorStatusRing(colorStatus) {
  var s = (colorStatus || '').toLowerCase()
  if (s === 'green') return 'ring-emerald-200 dark:ring-emerald-800'
  if (s === 'yellow') return 'ring-amber-200 dark:ring-amber-800'
  if (s === 'red') return 'ring-red-200 dark:ring-red-800'
  return 'ring-gray-200 dark:ring-gray-700'
}


var SortArrow = {
  props: { direction: { type: String, default: 'none' } },
  template: '<svg v-if="direction !== \'none\'" class="w-3 h-3 inline-block transition-transform" :class="{ \'rotate-180\': direction === \'desc\' }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg>'
}

defineExpose({ expandAll, collapseAll })
</script>

<template>
  <div class="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
    <div class="flex items-center justify-between gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
      <span class="text-xs font-semibold text-gray-700 dark:text-gray-200">Component load</span>
      <AlignmentLegendPopover variant="button" align="right" />
    </div>
    <div class="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)]">
    <table class="w-full text-sm border-collapse min-w-[1400px]">
      <tbody>
        <template v-for="comp in componentGroups" :key="comp.component">
          <!-- Component group header -->
          <tr
            class="cursor-pointer select-none border-l-4 transition-colors bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-800/80 hover:from-gray-200 hover:to-gray-100 dark:hover:from-gray-750 dark:hover:to-gray-800"
            :class="COMP_STYLE.border"
            @click="toggleComponent(comp.component)"
          >
            <td colspan="14" class="px-4 py-3">
              <div class="flex flex-wrap items-center gap-2">
                <svg
                  class="w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 flex-shrink-0"
                  :class="{ 'rotate-90': isComponentExpanded(comp.component) }"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span class="w-2 h-2 rounded-full flex-shrink-0" :class="COMP_STYLE.dot" />
                <span class="font-bold text-gray-900 dark:text-gray-100">{{ comp.component }}</span>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  {{ comp.requestedCount }} requested
                </span>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                  {{ comp.committedCount }} committed
                </span>
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  :class="comp.blockedCount > 0
                    ? 'bg-red-100 dark:bg-red-800/40 text-red-700 dark:text-red-300'
                    : 'bg-gray-100 dark:bg-gray-700/60 text-gray-400 dark:text-gray-500'"
                >{{ comp.blockedCount }} blocked</span>
                <template v-for="cat in ALIGNMENT_DISPLAY_KEYS" :key="cat">
                  <span
                    v-if="cat !== 'after_requested'"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    :class="comp.alignmentCounts[cat] > 0
                      ? alignmentCategoryChipClass(cat)
                      : 'bg-gray-100 dark:bg-gray-700/60 text-gray-400 dark:text-gray-500'"
                    :title="'Unique features in this component only. Hub tiles above count each issue once across all components.'"
                  >{{ comp.alignmentCounts[cat] || 0 }} {{ alignmentCategoryLabel(cat) }}</span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    :class="afterRequestedSplit(comp.alignmentCounts).total > 0
                      ? 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                      : 'bg-gray-100 dark:bg-gray-700/60 text-gray-400 dark:text-gray-500'"
                    title="After requested: yellow until the committed version freeze, then green. Unique features in this component only."
                  >
                    <span class="tabular-nums" :class="afterRequestedSplit(comp.alignmentCounts).yellow > 0 ? 'text-amber-700 dark:text-amber-300' : ''">{{ afterRequestedSplit(comp.alignmentCounts).yellow }}</span>
                    <span>/</span>
                    <span class="tabular-nums" :class="afterRequestedSplit(comp.alignmentCounts).green > 0 ? 'text-emerald-700 dark:text-emerald-300' : ''">{{ afterRequestedSplit(comp.alignmentCounts).green }}</span>
                    After requested
                  </span>
                </template>
              </div>
              <div v-if="getLeads(comp.component)" class="flex items-center gap-5 mt-2 ml-[38px]">
                <div v-if="getLeads(comp.component).pmLead" class="flex items-center gap-1.5">
                  <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/40">
                    <svg class="w-3 h-3 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <span class="text-[11px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wide">PM</span>
                  <span class="text-xs text-gray-700 dark:text-gray-300 font-medium">{{ getLeads(comp.component).pmLead }}</span>
                </div>
                <div v-if="getLeads(comp.component).engLead" class="flex items-center gap-1.5">
                  <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-900/40">
                    <svg class="w-3 h-3 text-sky-600 dark:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <span class="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wide">Eng</span>
                  <span class="text-xs text-gray-700 dark:text-gray-300 font-medium">{{ getLeads(comp.component).engLead }}</span>
                </div>
              </div>
            </td>
          </tr>

          <!-- Column headers -->
          <tr
            v-if="isComponentExpanded(comp.component)"
            class="border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/80 sticky top-0"
          >
            <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" @click="toggleSort('key')">
              <span class="inline-flex items-center gap-1">Feature<SortArrow :direction="sortIcon('key')" /></span>
            </th>
            <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" @click="toggleSort('summary')">
              <span class="inline-flex items-center gap-1">Title<SortArrow :direction="sortIcon('summary')" /></span>
            </th>
            <th class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" @click="toggleSort('priority')">
              <span class="inline-flex items-center gap-1 justify-center">Priority<SortArrow :direction="sortIcon('priority')" /></span>
            </th>
            <th class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" @click="toggleSort('releaseType')">
              <span class="inline-flex items-center gap-1 justify-center">Release Type<SortArrow :direction="sortIcon('releaseType')" /></span>
            </th>
            <th class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" @click="toggleSort('status')">
              <span class="inline-flex items-center gap-1 justify-center">Status<SortArrow :direction="sortIcon('status')" /></span>
            </th>
            <th class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" @click="toggleSort('colorStatus')">
              <span class="inline-flex items-center gap-1 justify-center">Color Status<SortArrow :direction="sortIcon('colorStatus')" /></span>
            </th>
            <th class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" @click="toggleSort('fixVersion')">
              <span class="inline-flex items-center gap-1 justify-center">Fix Version<SortArrow :direction="sortIcon('fixVersion')" /></span>
            </th>
            <th class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" @click="toggleSort('targetVersion')">
              <span class="inline-flex items-center gap-1 justify-center">Target Version<SortArrow :direction="sortIcon('targetVersion')" /></span>
            </th>
            <th class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" @click="toggleSort('blocked')">
              <span class="inline-flex items-center gap-1 justify-center">Blocked<SortArrow :direction="sortIcon('blocked')" /></span>
            </th>
            <th class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" @click="toggleSort('alignmentCategory')" title="TV vs FV Delta category for this release (same rules as Reports → TV vs FV Delta)">
              <span class="inline-flex items-center gap-1 justify-center">TV/FV Align<SortArrow :direction="sortIcon('alignmentCategory')" /></span>
            </th>
            <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[10rem] cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" @click="toggleSort('readiness')">
              <span class="inline-flex items-center gap-1">Readiness<SortArrow :direction="sortIcon('readiness')" /></span>
            </th>
            <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" @click="toggleSort('assignee')">
              <span class="inline-flex items-center gap-1">Delivery Owner<SortArrow :direction="sortIcon('assignee')" /></span>
            </th>
            <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" @click="toggleSort('pmOwner')">
              <span class="inline-flex items-center gap-1">PM Owner<SortArrow :direction="sortIcon('pmOwner')" /></span>
            </th>
            <th
              class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              @click="toggleSort('docs')"
              title="Jira Docs Required field. Yes without a Documentation component fails Docs impact readiness."
            >
              <span class="inline-flex items-center gap-1 justify-center">Docs Required<SortArrow :direction="sortIcon('docs')" /></span>
            </th>
          </tr>

          <!-- Feature rows -->
          <template v-if="isComponentExpanded(comp.component)">
            <tr
              v-for="feature in sortFeatures(comp.features)"
              :key="feature.key"
              role="button"
              tabindex="0"
              class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
              @click="emit('select', feature)"
              @keydown.enter.prevent="emit('select', feature)"
              @keydown.space.prevent="emit('select', feature)"
            >
              <td class="px-3 py-2.5 whitespace-nowrap">
                <a
                  :href="`${JIRA_BASE}/${feature.key}`"
                  target="_blank"
                  rel="noopener"
                  class="font-mono text-xs font-medium text-primary-600 dark:text-blue-400 hover:underline hover:text-primary-700 dark:hover:text-blue-300 transition-colors"
                  @click.stop
                >{{ feature.key }}</a>
              </td>
              <td class="px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100">
                {{ feature.summary }}
              </td>
              <td class="px-3 py-2.5 text-center">
                <span
                  v-if="feature.priority"
                  class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                  :class="{
                    'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300': feature.priority === 'Blocker' || feature.priority === 'Critical',
                    'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300': feature.priority === 'Major',
                    'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300': feature.priority === 'Normal',
                    'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-400': feature.priority !== 'Blocker' && feature.priority !== 'Critical' && feature.priority !== 'Major' && feature.priority !== 'Normal'
                  }"
                >{{ feature.priority }}</span>
                <span v-else class="text-gray-300 dark:text-gray-600 text-xs">--</span>
              </td>
              <td class="px-3 py-2.5 text-center">
                <span
                  v-if="feature.releaseType"
                  class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                >{{ feature.releaseType }}</span>
                <span v-else class="text-gray-300 dark:text-gray-600 text-xs">--</span>
              </td>
              <td class="px-3 py-2.5 text-center">
                <span
                  v-if="feature.status"
                  class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300"
                >{{ feature.status }}</span>
                <span v-else class="text-gray-300 dark:text-gray-600 text-xs">--</span>
              </td>
              <td class="px-3 py-2.5 text-center">
                <span
                  v-if="feature.colorStatus"
                  class="inline-block w-3.5 h-3.5 rounded-full ring-2"
                  :class="[colorStatusClass(feature.colorStatus), colorStatusRing(feature.colorStatus)]"
                  :title="feature.colorStatus"
                />
                <span v-else class="text-gray-300 dark:text-gray-600 text-xs">--</span>
              </td>
              <td class="px-3 py-2.5 text-center">
                <div v-if="feature.fixVersions && feature.fixVersions.length > 0" class="flex items-center justify-center gap-1 flex-wrap">
                  <span
                    v-for="fv in feature.fixVersions"
                    :key="fv"
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                  >{{ fv }}</span>
                </div>
                <span v-else class="text-gray-300 dark:text-gray-600 text-xs">--</span>
              </td>
              <td class="px-3 py-2.5 text-center">
                <div v-if="feature.targetVersions && feature.targetVersions.length > 0" class="flex items-center justify-center gap-1 flex-wrap">
                  <span
                    v-for="tv in feature.targetVersions"
                    :key="tv"
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                  >{{ tv }}</span>
                </div>
                <span v-else class="text-gray-300 dark:text-gray-600 text-xs">--</span>
              </td>
              <td class="px-3 py-2.5 text-center">
                <span
                  v-if="feature.isBlocked"
                  class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 ring-1 ring-red-200 dark:ring-red-800"
                  :title="feature.blockedBy && feature.blockedBy.length ? 'Blocked by: ' + feature.blockedBy.map(function(b) { return b.key + ' (' + b.status + ')' }).join(', ') : 'Blocked'"
                >
                  <svg class="w-3.5 h-3.5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </span>
                <svg v-else class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </td>
              <td class="px-3 py-2.5 text-center">
                <AlignmentPopover :feature="feature" />
              </td>
              <td class="px-3 py-2.5">
                <div v-if="feature.fpdor" class="flex flex-wrap items-center gap-1 max-w-[14rem]">
                  <FPDoRPopover
                    :fpdor="feature.fpdor"
                    :confidence="feature.confidence"
                  />
                  <span
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                    :class="pathChipClass(feature)"
                    :title="pathChipTitle(feature)"
                  >{{ pathLabel(feature) }}</span>
                  <span
                    v-for="name in visibleFailChips(feature)"
                    :key="name"
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                    :class="chipClassForName(name)"
                    :title="chipTitleForName(name)"
                  >{{ name }}</span>
                  <span
                    v-if="overflowFailCount(feature) > 0"
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-gray-500 dark:text-gray-400"
                    :title="failedFpdorNames(feature).slice(MAX_VISIBLE_FAIL_CHIPS).join(', ')"
                  >+{{ overflowFailCount(feature) }}</span>
                </div>
                <span v-else class="text-gray-300 dark:text-gray-600 text-xs">—</span>
              </td>
              <td class="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {{ feature.assignee || '--' }}
              </td>
              <td class="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {{ feature.pmOwner || '--' }}
              </td>
              <td class="px-3 py-2.5 text-center">
                <span
                  class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                  :class="docsRequiredChipClass(feature)"
                  :title="docsRequiredTitle(feature)"
                >
                  <template v-if="docsRequiredState(feature) === 'yes-missing-component'">
                    Yes<span aria-hidden="true">⚠</span>
                  </template>
                  <template v-else>{{ docsRequiredLabel(feature) }}</template>
                </span>
              </td>
            </tr>
          </template>

          <!-- Empty state -->
          <tr v-if="isComponentExpanded(comp.component) && comp.features.length === 0">
            <td colspan="14" class="px-8 py-6 text-sm text-gray-400 dark:text-gray-500 italic text-center">
              No features found for {{ comp.component }}
            </td>
          </tr>
        </template>

        <!-- No results -->
        <tr v-if="componentGroups.length === 0">
          <td colspan="14" class="px-8 py-10 text-sm text-gray-400 dark:text-gray-500 italic text-center">
            No features match the current filters.
          </td>
        </tr>
      </tbody>
    </table>
    </div>
  </div>
</template>
