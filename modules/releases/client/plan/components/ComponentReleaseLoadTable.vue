<script setup>
import { reactive, computed } from 'vue'

const props = defineProps({
  groups: { type: Array, default: () => [] },
  activeFilter: { type: String, default: null }
})

const JIRA_BASE = 'https://redhat.atlassian.net/browse'

const COMP_STYLE = {
  bg: 'bg-slate-50 dark:bg-slate-800/40',
  border: 'border-l-primary-500',
  badge: 'bg-primary-100 dark:bg-primary-800/40 text-primary-700 dark:text-primary-300',
  dot: 'bg-primary-500'
}

var expandedComponents = reactive({})

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

function extractProduct(versionName) {
  if (!versionName) return versionName
  var lower = versionName.toLowerCase()
  if (lower.startsWith('rhoai')) return 'RHOAI'
  if (lower.startsWith('rhelai')) return 'RHELAI'
  if (lower.startsWith('rhaii')) return 'RHAII'
  return versionName.split('-')[0] || versionName
}

var componentGroups = computed(function() {
  var filter = props.activeFilter
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
          features: {},
          requestedCount: 0,
          committedCount: 0,
          blockedCount: 0
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

        if (filter === 'requested' && !isReq) continue
        if (filter === 'committed' && !isCom) continue
        if (filter === 'blocked' && !feat.isBlocked) continue

        if (!cg.features[feat.key]) {
          cg.features[feat.key] = {
            key: feat.key,
            summary: feat.summary,
            status: feat.status,
            colorStatus: feat.colorStatus,
            statusSummary: feat.statusSummary,
            releaseType: feat.releaseType,
            isBlocked: feat.isBlocked,
            components: feat.components,
            assignee: feat.assignee,
            pmOwner: feat.pmOwner,
            products: [],
            isRequested: false,
            isCommitted: false
          }
        }

        var entry = cg.features[feat.key]
        var product = extractProduct(version)
        if (entry.products.indexOf(product) === -1) {
          entry.products.push(product)
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

function productBadgeClass(product) {
  var p = (product || '').toUpperCase()
  if (p === 'RHOAI') return 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
  if (p === 'RHELAI') return 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
  if (p === 'RHAII') return 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300'
  return 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-400'
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
            <td colspan="9" class="px-4 py-3.5">
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
              </div>
            </td>
          </tr>

          <!-- Column headers -->
          <tr
            v-if="isComponentExpanded(comp.component)"
            class="border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/80 sticky top-0"
          >
            <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">Feature</th>
            <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
            <th class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">Product</th>
            <th class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">Type</th>
            <th class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Release Type</th>
            <th class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">Status</th>
            <th class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">Blocked</th>
            <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">Delivery Owner</th>
            <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">PM Owner</th>
          </tr>

          <!-- Feature rows -->
          <template v-if="isComponentExpanded(comp.component)">
            <tr
              v-for="feature in comp.features"
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
                <div class="flex items-center justify-center gap-1 flex-wrap">
                  <span
                    v-for="prod in feature.products"
                    :key="prod"
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold"
                    :class="productBadgeClass(prod)"
                  >{{ prod }}</span>
                </div>
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
                  v-if="feature.colorStatus"
                  class="inline-block w-3.5 h-3.5 rounded-full ring-2"
                  :class="[colorStatusClass(feature.colorStatus), colorStatusRing(feature.colorStatus)]"
                  :title="feature.colorStatus"
                />
                <span v-else class="text-gray-300 dark:text-gray-600 text-xs">--</span>
              </td>
              <td class="px-3 py-2.5 text-center">
                <span
                  v-if="feature.isBlocked"
                  class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 ring-1 ring-red-200 dark:ring-red-800"
                  title="Blocked"
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
            <td colspan="9" class="px-8 py-6 text-sm text-gray-400 dark:text-gray-500 italic text-center">
              No features found for {{ comp.component }}
            </td>
          </tr>
        </template>

        <!-- No matching results for active filter -->
        <tr v-if="componentGroups.length === 0 && activeFilter">
          <td colspan="9" class="px-8 py-10 text-sm text-gray-400 dark:text-gray-500 italic text-center">
            No {{ activeFilter }} features found.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
