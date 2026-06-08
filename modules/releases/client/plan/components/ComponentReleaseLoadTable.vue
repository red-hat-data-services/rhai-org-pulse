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

var expandedVersions = reactive({})
var expandedComponents = reactive({})

function toggleVersion(version) {
  if (expandedVersions[version]) {
    delete expandedVersions[version]
  } else {
    expandedVersions[version] = true
  }
}

function isVersionExpanded(version) {
  return !!expandedVersions[version]
}

function compGroupKey(version, component) {
  return version + '::' + component
}

function toggleComponent(version, component) {
  var key = compGroupKey(version, component)
  if (expandedComponents[key]) {
    delete expandedComponents[key]
  } else {
    expandedComponents[key] = true
  }
}

function isComponentExpanded(version, component) {
  return !!expandedComponents[compGroupKey(version, component)]
}

function expandAll() {
  var src = filteredGroups.value
  for (var i = 0; i < src.length; i++) {
    var g = src[i]
    expandedVersions[g.version] = true
    for (var j = 0; j < g.components.length; j++) {
      expandedComponents[compGroupKey(g.version, g.components[j].component)] = true
    }
  }
}

function collapseAll() {
  var src = filteredGroups.value
  for (var i = 0; i < src.length; i++) {
    var g = src[i]
    delete expandedVersions[g.version]
    for (var j = 0; j < g.components.length; j++) {
      delete expandedComponents[compGroupKey(g.version, g.components[j].component)]
    }
  }
}

function allFeaturesForComponent(comp) {
  var seen = {}
  var result = []
  var lists = [comp.requestedFeatures || [], comp.committedFeatures || []]
  for (var li = 0; li < lists.length; li++) {
    for (var fi = 0; fi < lists[li].length; fi++) {
      var f = lists[li][fi]
      if (!seen[f.key]) {
        seen[f.key] = true
        result.push(f)
      }
    }
  }
  return result
}

function filterFeaturesForComp(comp, filter) {
  var all = allFeaturesForComponent(comp)
  if (!filter) return all

  var reqKeys = {}
  var comKeys = {}
  var reqList = comp.requestedFeatures || []
  var comList = comp.committedFeatures || []
  for (var i = 0; i < reqList.length; i++) reqKeys[reqList[i].key] = true
  for (var j = 0; j < comList.length; j++) comKeys[comList[j].key] = true

  return all.filter(function(f) {
    if (filter === 'requested') return !!reqKeys[f.key]
    if (filter === 'committed') return !!comKeys[f.key]
    if (filter === 'blocked') return !!f.isBlocked
    return true
  })
}

var filteredGroups = computed(function() {
  var filter = props.activeFilter

  return props.groups.map(function(group) {
    var filteredComps = group.components.map(function(comp) {
      var features = filterFeaturesForComp(comp, filter)
      return Object.assign({}, comp, {
        displayFeatures: features
      })
    }).filter(function(comp) {
      return comp.displayFeatures.length > 0
    })

    return Object.assign({}, group, {
      components: filteredComps
    })
  }).filter(function(group) {
    return group.components.length > 0
  })
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

defineExpose({ expandAll, collapseAll })
</script>

<template>
  <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
    <table class="w-full text-sm border-collapse">
      <tbody>
        <template v-for="group in filteredGroups" :key="group.version">
          <!-- Version group header -->
          <tr
            class="cursor-pointer select-none bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-800/80 hover:from-gray-200 hover:to-gray-100 dark:hover:from-gray-750 dark:hover:to-gray-800"
            @click="toggleVersion(group.version)"
          >
            <td colspan="7" class="px-4 py-3.5">
              <div class="flex items-center gap-3">
                <svg
                  class="w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 flex-shrink-0"
                  :class="{ 'rotate-90': isVersionExpanded(group.version) }"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span class="font-bold text-gray-900 dark:text-gray-100">{{ group.version }}</span>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  {{ group.requestedCount }} requested
                </span>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                  {{ group.committedCount }} committed
                </span>
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  :class="group.blockedCount > 0
                    ? 'bg-red-100 dark:bg-red-800/40 text-red-700 dark:text-red-300'
                    : 'bg-gray-100 dark:bg-gray-700/60 text-gray-400 dark:text-gray-500'"
                >{{ group.blockedCount }} blocked</span>
              </div>
            </td>
          </tr>

          <template v-if="isVersionExpanded(group.version)">
            <template v-for="comp in group.components" :key="comp.component">
              <!-- Component group header -->
              <tr
                class="cursor-pointer select-none border-l-4 transition-colors hover:brightness-95 dark:hover:brightness-110"
                :class="[COMP_STYLE.border, COMP_STYLE.bg]"
                @click="toggleComponent(group.version, comp.component)"
              >
                <td colspan="7" class="px-6 py-2.5">
                  <div class="flex items-center">
                    <svg
                      class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform duration-200 flex-shrink-0 mr-2.5"
                      :class="{ 'rotate-90': isComponentExpanded(group.version, comp.component) }"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span class="w-2 h-2 rounded-full flex-shrink-0 mr-1.5" :class="COMP_STYLE.dot" />
                    <span class="font-semibold text-gray-800 dark:text-gray-200 mr-3">{{ comp.component }}</span>
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold mr-2 bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300">
                      {{ comp.requestedCount }} requested
                    </span>
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold mr-2 bg-emerald-100 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300">
                      {{ comp.committedCount }} committed
                    </span>
                    <span
                      class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                      :class="comp.blockedCount > 0
                        ? 'bg-red-100 dark:bg-red-800/40 text-red-700 dark:text-red-300'
                        : 'bg-gray-100 dark:bg-gray-700/60 text-gray-400 dark:text-gray-500'"
                    >{{ comp.blockedCount }} blocked</span>
                  </div>
                </td>
              </tr>

              <!-- Column headers -->
              <tr
                v-if="isComponentExpanded(group.version, comp.component)"
                class="border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/80 sticky top-0"
              >
                <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">Feature</th>
                <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
                <th class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">Type</th>
                <th class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">Status</th>
                <th class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">Blocked</th>
                <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">Delivery Owner</th>
                <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">PM Owner</th>
              </tr>

              <!-- Feature rows -->
              <template v-if="isComponentExpanded(group.version, comp.component)">
                <tr
                  v-for="feature in comp.displayFeatures"
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
                    <div class="flex items-center justify-center gap-1">
                      <span
                        v-if="(comp.requestedFeatures || []).some(function(r) { return r.key === feature.key })"
                        class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300"
                      >REQ</span>
                      <span
                        v-if="(comp.committedFeatures || []).some(function(r) { return r.key === feature.key })"
                        class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300"
                      >COM</span>
                    </div>
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
              <tr v-if="isComponentExpanded(group.version, comp.component) && comp.displayFeatures.length === 0">
                <td colspan="7" class="px-8 py-6 text-sm text-gray-400 dark:text-gray-500 italic text-center">
                  No features found for {{ comp.component }}
                </td>
              </tr>
            </template>
          </template>
        </template>
        <!-- No matching results for active filter -->
        <tr v-if="filteredGroups.length === 0 && activeFilter">
          <td colspan="7" class="px-8 py-10 text-sm text-gray-400 dark:text-gray-500 italic text-center">
            No {{ activeFilter }} features found.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
