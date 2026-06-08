<script setup>
import { reactive } from 'vue'

const props = defineProps({
  groups: { type: Array, default: () => [] },
  portfolioVersion: { type: String, default: '' },
  featureFreezeDate: { type: String, default: null },
  freezeLabel: { type: String, default: 'Freeze' }
})

const JIRA_BASE = 'https://redhat.atlassian.net/browse'

const PRODUCT_COLORS = {
  rhoai: { bg: 'bg-violet-50 dark:bg-violet-900/15', border: 'border-l-violet-500', badge: 'bg-violet-100 dark:bg-violet-800/40 text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  rhelai: { bg: 'bg-teal-50 dark:bg-teal-900/15', border: 'border-l-teal-500', badge: 'bg-teal-100 dark:bg-teal-800/40 text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
  rhaii: { bg: 'bg-sky-50 dark:bg-sky-900/15', border: 'border-l-sky-500', badge: 'bg-sky-100 dark:bg-sky-800/40 text-sky-700 dark:text-sky-300', dot: 'bg-sky-500' }
}

const DEFAULT_COLORS = { bg: 'bg-gray-50 dark:bg-gray-800/50', border: 'border-l-gray-400', badge: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300', dot: 'bg-gray-400' }

function productColors(product) {
  return PRODUCT_COLORS[product] || DEFAULT_COLORS
}

const expandedPortfolio = reactive({})
const expandedProducts = reactive({})

function togglePortfolio(version) {
  if (expandedPortfolio[version]) {
    delete expandedPortfolio[version]
  } else {
    expandedPortfolio[version] = true
  }
}

function isPortfolioExpanded(version) {
  return !!expandedPortfolio[version]
}

function productGroupKey(version, product) {
  return version + '::' + product
}

function toggleProduct(version, product) {
  var key = productGroupKey(version, product)
  if (expandedProducts[key]) {
    delete expandedProducts[key]
  } else {
    expandedProducts[key] = true
  }
}

function isProductExpanded(version, product) {
  return !!expandedProducts[productGroupKey(version, product)]
}

function expandAll() {
  expandedPortfolio[props.portfolioVersion] = true
  for (var i = 0; i < props.groups.length; i++) {
    expandedProducts[productGroupKey(props.portfolioVersion, props.groups[i].product)] = true
  }
}

function collapseAll() {
  delete expandedPortfolio[props.portfolioVersion]
  for (var i = 0; i < props.groups.length; i++) {
    delete expandedProducts[productGroupKey(props.portfolioVersion, props.groups[i].product)]
  }
}

function totalFeatureCount() {
  var count = 0
  for (var i = 0; i < props.groups.length; i++) {
    count += props.groups[i].featureCount || 0
  }
  return count
}

function droppedCountForGroup(group) {
  var count = 0
  var features = group.features || []
  for (var i = 0; i < features.length; i++) {
    if (features[i].scopeChange === 'dropped') count++
  }
  return count
}

function addedCountForGroup(group) {
  var count = 0
  var features = group.features || []
  for (var i = 0; i < features.length; i++) {
    if (features[i].scopeChange === 'added') count++
  }
  return count
}

function blockedCountForGroup(group) {
  var count = 0
  var features = group.features || []
  for (var i = 0; i < features.length; i++) {
    if (features[i].isBlocked && features[i].scopeChange !== 'dropped') count++
  }
  return count
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  var d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function stripHtml(html) {
  var s = html || ''
  var prev
  do {
    prev = s
    s = s.replace(/<[^>]*>/g, '')
  } while (s !== prev)
  return s
}

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
        <!-- Portfolio release group header -->
        <tr
          class="cursor-pointer select-none bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-800/80 hover:from-gray-200 hover:to-gray-100 dark:hover:from-gray-750 dark:hover:to-gray-800"
          @click="togglePortfolio(portfolioVersion)"
        >
          <td colspan="8" class="px-4 py-3.5">
            <div class="flex items-center gap-3">
              <svg
                class="w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200"
                :class="{ 'rotate-90': isPortfolioExpanded(portfolioVersion) }"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span class="font-bold text-gray-900 dark:text-gray-100">RHAI {{ portfolioVersion }}</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                {{ totalFeatureCount() }} features
              </span>
              <span
                v-if="featureFreezeDate"
                class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                :class="new Date().toISOString().split('T')[0] >= featureFreezeDate
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                  : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'"
              >
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {{ freezeLabel }}: {{ formatDate(featureFreezeDate) }}
              </span>
            </div>
          </td>
        </tr>

        <template v-if="isPortfolioExpanded(portfolioVersion)">
          <template v-for="group in groups" :key="group.product">
            <!-- Product group header -->
            <tr
              class="cursor-pointer select-none border-l-4 transition-colors"
              :class="[
                productColors(group.product).border,
                productColors(group.product).bg,
                'hover:brightness-95 dark:hover:brightness-110'
              ]"
              @click="toggleProduct(portfolioVersion, group.product)"
            >
              <td colspan="8" class="px-6 py-2.5">
                <div class="flex items-center gap-2.5">
                  <svg
                    class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform duration-200"
                    :class="{ 'rotate-90': isProductExpanded(portfolioVersion, group.product) }"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span class="inline-flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full" :class="productColors(group.product).dot" />
                    <span class="font-semibold text-gray-800 dark:text-gray-200">{{ group.product.toUpperCase() }}</span>
                  </span>
                  <span class="text-xs text-gray-500 dark:text-gray-400 font-mono">{{ group.releaseNumber }}</span>
                  <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold" :class="productColors(group.product).badge">
                    {{ group.featureCount }}
                  </span>
                  <span
                    class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                    :class="addedCountForGroup(group) > 0
                      ? 'bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-700/60 text-gray-400 dark:text-gray-500'"
                  >{{ addedCountForGroup(group) > 0 ? '+' : '' }}{{ addedCountForGroup(group) }} late</span>
                  <span
                    class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                    :class="droppedCountForGroup(group) > 0
                      ? 'bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300'
                      : 'bg-gray-100 dark:bg-gray-700/60 text-gray-400 dark:text-gray-500'"
                  >{{ droppedCountForGroup(group) }} dropped</span>
                  <span
                    class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                    :class="blockedCountForGroup(group) > 0
                      ? 'bg-red-100 dark:bg-red-800/40 text-red-700 dark:text-red-300'
                      : 'bg-gray-100 dark:bg-gray-700/60 text-gray-400 dark:text-gray-500'"
                  >{{ blockedCountForGroup(group) }} blocked</span>
                </div>
              </td>
            </tr>

            <!-- Column headers -->
            <tr
              v-if="isProductExpanded(portfolioVersion, group.product)"
              class="border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/80 sticky top-0"
            >
              <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">Feature</th>
              <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
              <th class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">Status</th>
              <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-52">Status Summary</th>
              <th class="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">Blocked</th>
              <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40">Components</th>
              <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">Delivery Owner</th>
              <th class="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">PM Owner</th>
            </tr>

            <!-- Feature rows -->
            <template v-if="isProductExpanded(portfolioVersion, group.product)">
              <tr
                v-for="feature in group.features"
                :key="feature.key"
                class="border-b border-gray-100 dark:border-gray-800 transition-colors"
                :class="{
                  'bg-blue-50/50 dark:bg-blue-900/10 border-l-4 border-l-blue-400 dark:border-l-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20': feature.scopeChange === 'added',
                  'bg-amber-50/30 dark:bg-amber-900/5 border-l-4 border-l-amber-300 dark:border-l-amber-700 opacity-60 hover:opacity-80': feature.scopeChange === 'dropped',
                  'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50': !feature.scopeChange
                }"
              >
                <!-- Feature key -->
                <td class="px-3 py-2.5 whitespace-nowrap">
                  <div class="flex items-center gap-1.5">
                    <a
                      :href="`${JIRA_BASE}/${feature.key}`"
                      target="_blank"
                      rel="noopener"
                      class="font-mono text-xs font-medium text-primary-600 dark:text-blue-400 hover:underline hover:text-primary-700 dark:hover:text-blue-300 transition-colors"
                      :class="{ 'line-through': feature.scopeChange === 'dropped' }"
                    >{{ feature.key }}</a>
                    <span
                      v-if="feature.scopeChange === 'added'"
                      class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-800/50 text-blue-700 dark:text-blue-300 shadow-sm"
                    >
                      <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m6-6H6" />
                      </svg>
                      Late
                    </span>
                    <span
                      v-if="feature.scopeChange === 'dropped'"
                      class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300"
                      :title="feature.fixVersionRemovedAt ? 'Removed: ' + formatDate(feature.fixVersionRemovedAt) : 'fixVersion removed'"
                    >
                      <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
                      </svg>
                      Dropped
                    </span>
                  </div>
                </td>

                <!-- Title -->
                <td class="px-3 py-2.5">
                  <span
                    class="text-sm text-gray-900 dark:text-gray-100"
                    :class="{ 'line-through text-gray-400 dark:text-gray-500': feature.scopeChange === 'dropped' }"
                  >{{ feature.summary }}</span>
                </td>

                <!-- Status Color -->
                <td class="px-3 py-2.5 text-center">
                  <span
                    v-if="feature.colorStatus"
                    class="inline-block w-3.5 h-3.5 rounded-full ring-2"
                    :class="[colorStatusClass(feature.colorStatus), colorStatusRing(feature.colorStatus)]"
                    :title="feature.colorStatus"
                  />
                  <span v-else class="text-gray-300 dark:text-gray-600 text-xs">--</span>
                </td>

                <!-- Status Summary -->
                <td class="px-3 py-2.5">
                  <span
                    v-if="feature.statusSummary"
                    class="text-xs text-gray-600 dark:text-gray-300 max-w-[200px] truncate block"
                    :title="stripHtml(feature.statusSummary)"
                  >{{ stripHtml(feature.statusSummary) }}</span>
                  <span v-else class="text-gray-300 dark:text-gray-600 text-xs">--</span>
                </td>

                <!-- Blocked -->
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
                </td>

                <!-- Components -->
                <td class="px-3 py-2.5">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="comp in (feature.components || []).slice(0, 3)"
                      :key="comp"
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                    >{{ comp }}</span>
                    <span
                      v-if="(feature.components || []).length > 3"
                      class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800"
                    >+{{ feature.components.length - 3 }}</span>
                  </div>
                </td>

                <!-- Delivery Owner -->
                <td class="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {{ feature.assignee || '--' }}
                </td>

                <!-- PM Owner -->
                <td class="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {{ feature.pmOwner || '--' }}
                </td>
              </tr>
            </template>

            <!-- Empty state for product group -->
            <tr
              v-if="isProductExpanded(portfolioVersion, group.product) && group.features.length === 0"
            >
              <td colspan="8" class="px-8 py-6 text-sm text-gray-400 dark:text-gray-500 italic text-center">
                No features found for {{ group.releaseNumber }}
              </td>
            </tr>
          </template>
        </template>
      </tbody>
    </table>
  </div>
</template>
