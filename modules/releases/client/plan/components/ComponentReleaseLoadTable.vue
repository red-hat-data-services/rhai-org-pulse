<script setup>
import { reactive, computed } from 'vue'

const props = defineProps({
  groups: { type: Array, default: () => [] },
  componentLeads: { type: Object, default: () => ({}) },
  velocity: { type: Object, default: null },
  initialSort: { type: Object, default: () => ({ column: null, direction: 'asc' }) }
})

var emit = defineEmits(['sort-changed'])

function getComponentVelocity(componentName) {
  if (!props.velocity || !props.velocity.components) return null
  var comps = props.velocity.components
  for (var i = 0; i < comps.length; i++) {
    if (comps[i].component === componentName) return comps[i]
  }
  return null
}

const JIRA_BASE = 'https://redhat.atlassian.net/browse'

const COMP_STYLE = {
  border: 'border-l-primary-500',
  dot: 'bg-primary-500'
}

var expandedComponents = reactive({})

// ═══ SORT STATE ═══

var SORT_COLUMNS = ['key', 'summary', 'priority', 'type', 'releaseType', 'status', 'colorStatus', 'fixVersion', 'targetVersion', 'blocked', 'assignee', 'pmOwner']

var PRIORITY_ORDER = { 'Blocker': 0, 'Critical': 1, 'Major': 2, 'Normal': 3 }
var COLOR_STATUS_ORDER = { 'red': 0, 'yellow': 1, 'green': 2 }

var sortState = reactive({
  column: props.initialSort.column,
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
  if (column === 'type') {
    return (feature.isCommitted ? 2 : 0) + (feature.isRequested ? 1 : 0)
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
  if (column === 'assignee') return (feature.assignee || '').toLowerCase()
  if (column === 'pmOwner') return (feature.pmOwner || '').toLowerCase()
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
  var lower = (componentName || '').toLowerCase()
  var leads = props.componentLeads
  if (leads[lower]) return leads[lower]
  var keys = Object.keys(leads)
  for (var i = 0; i < keys.length; i++) {
    if (lower.includes(keys[i]) || keys[i].includes(lower)) return leads[keys[i]]
  }
  return null
}

function extractProduct(versionName) {
  if (!versionName) return versionName
  var lower = versionName.toLowerCase()
  if (lower.startsWith('rhoai')) return 'RHOAI'
  if (lower.startsWith('rhelai')) return 'RHELAI'
  if (lower.startsWith('rhaii')) return 'RHAII'
  return versionName.split('-')[0] || versionName
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
            status: feat.status,
            colorStatus: feat.colorStatus,
            statusSummary: feat.statusSummary,
            releaseType: feat.releaseType,
            priority: feat.priority,
            isBlocked: feat.isBlocked,
            blockedBy: feat.blockedBy || [],
            components: feat.components,
            fixVersions: feat.fixVersions || [],
            targetVersions: feat.targetVersions || [],
            assignee: feat.assignee,
            pmOwner: feat.pmOwner,
            products: [],
            versions: [],
            isRequested: false,
            isCommitted: false
          }
        }

        var entry = cg.features[feat.key]
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
      blockedCount: blkCount
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
  <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
    <table class="w-full text-sm border-collapse">
      <tbody>
        <template v-for="comp in componentGroups" :key="comp.component">
          <!-- Component group header -->
          <tr
            class="cursor-pointer select-none border-l-4 transition-colors bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-800/80 hover:from-gray-200 hover:to-gray-100 dark:hover:from-gray-750 dark:hover:to-gray-800"
            :class="COMP_STYLE.border"
            @click="toggleComponent(comp.component)"
          >
            <td colspan="12" class="px-4 py-3">
              <div class="flex items-center gap-3">
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
                <span
                  v-if="getComponentVelocity(comp.component)"
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                  :title="getComponentVelocity(comp.component).isPartialYear ? 'Less than a year of data' : ''"
                >{{ getComponentVelocity(comp.component).avgPerRelease }} avg/rel<span v-if="getComponentVelocity(comp.component).isPartialYear" class="ml-0.5 text-gray-400 dark:text-gray-500">*</span></span>
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
            <th class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" @click="toggleSort('type')">
              <span class="inline-flex items-center gap-1 justify-center">Type<SortArrow :direction="sortIcon('type')" /></span>
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
            <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" @click="toggleSort('assignee')">
              <span class="inline-flex items-center gap-1">Delivery Owner<SortArrow :direction="sortIcon('assignee')" /></span>
            </th>
            <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" @click="toggleSort('pmOwner')">
              <span class="inline-flex items-center gap-1">PM Owner<SortArrow :direction="sortIcon('pmOwner')" /></span>
            </th>
          </tr>

          <!-- Feature rows -->
          <template v-if="isComponentExpanded(comp.component)">
            <tr
              v-for="feature in sortFeatures(comp.features)"
              :key="feature.key"
              class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <td class="px-3 py-2.5 whitespace-nowrap">
                <a
                  :href="`${JIRA_BASE}/${feature.key}`"
                  target="_blank"
                  rel="noopener"
                  class="font-mono text-xs font-medium text-primary-600 dark:text-blue-400 hover:underline hover:text-primary-700 dark:hover:text-blue-300 transition-colors"
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
                <div class="flex items-center justify-center gap-1">
                  <span
                    v-if="feature.isRequested"
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300"
                  >REQ</span>
                  <span
                    v-if="feature.isCommitted"
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300"
                  >COM</span>
                </div>
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
              <td class="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {{ feature.assignee || '--' }}
              </td>
              <td class="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {{ feature.pmOwner || '--' }}
              </td>
            </tr>
          </template>

          <!-- Empty state -->
          <tr v-if="isComponentExpanded(comp.component) && comp.features.length === 0">
            <td colspan="12" class="px-8 py-6 text-sm text-gray-400 dark:text-gray-500 italic text-center">
              No features found for {{ comp.component }}
            </td>
          </tr>
        </template>

        <!-- No results -->
        <tr v-if="componentGroups.length === 0">
          <td colspan="12" class="px-8 py-10 text-sm text-gray-400 dark:text-gray-500 italic text-center">
            No features match the current filters.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
