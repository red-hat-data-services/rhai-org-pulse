<script setup>
import { reactive } from 'vue'

const props = defineProps({
  groups: { type: Array, default: () => [] },
  portfolioVersion: { type: String, default: '' },
  featureFreezeDate: { type: String, default: null }
})

const JIRA_BASE = 'https://redhat.atlassian.net/browse'

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

function formatDate(dateStr) {
  if (!dateStr) return ''
  var d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function colorStatusClass(colorStatus) {
  var s = (colorStatus || '').toLowerCase()
  if (s === 'green') return 'bg-green-500'
  if (s === 'yellow') return 'bg-yellow-500'
  if (s === 'red') return 'bg-red-500'
  return 'bg-gray-400'
}

defineExpose({ expandAll, collapseAll })
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-sm border-collapse">
      <!-- Portfolio release group header -->
      <tbody>
        <tr
          class="cursor-pointer select-none bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
          @click="togglePortfolio(portfolioVersion)"
        >
          <td colspan="8" class="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
            <div class="flex items-center gap-3">
              <svg
                class="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform"
                :class="{ 'rotate-90': isPortfolioExpanded(portfolioVersion) }"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span>RHAI {{ portfolioVersion }}</span>
              <span class="text-xs font-normal text-gray-500 dark:text-gray-400">
                ({{ totalFeatureCount() }} features)
              </span>
              <span
                v-if="featureFreezeDate"
                class="ml-2 inline-flex items-center gap-1 text-xs font-normal"
                :class="new Date().toISOString().split('T')[0] >= featureFreezeDate
                  ? 'text-orange-600 dark:text-orange-400'
                  : 'text-gray-500 dark:text-gray-400'"
              >
                Feature Freeze: {{ formatDate(featureFreezeDate) }}
              </span>
            </div>
          </td>
        </tr>

        <template v-if="isPortfolioExpanded(portfolioVersion)">
          <template v-for="group in groups" :key="group.product">
            <!-- Product group header -->
            <tr
              class="cursor-pointer select-none bg-gray-50 dark:bg-gray-750 hover:bg-gray-100 dark:hover:bg-gray-700"
              @click="toggleProduct(portfolioVersion, group.product)"
            >
              <td colspan="8" class="px-6 py-2.5 font-medium text-gray-800 dark:text-gray-200">
                <div class="flex items-center gap-2.5">
                  <svg
                    class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform"
                    :class="{ 'rotate-90': isProductExpanded(portfolioVersion, group.product) }"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span>{{ group.label }}</span>
                  <span class="text-xs font-normal text-gray-500 dark:text-gray-400">
                    ({{ group.featureCount }} features)
                  </span>
                </div>
              </td>
            </tr>

            <!-- Column headers (shown when product is expanded) -->
            <tr
              v-if="isProductExpanded(portfolioVersion, group.product)"
              class="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
            >
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">Feature</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
              <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">Status</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-52">Status Summary</th>
              <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">Blocked</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40">Components</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">Delivery Owner</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">PM Owner</th>
            </tr>

            <!-- Feature rows -->
            <template v-if="isProductExpanded(portfolioVersion, group.product)">
              <tr
                v-for="feature in group.features"
                :key="feature.key"
                class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                :class="{
                  'border-l-4 border-l-blue-400 dark:border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/10': feature.scopeChange === 'added',
                  'opacity-50': feature.scopeChange === 'dropped'
                }"
              >
                <!-- Feature key -->
                <td class="px-3 py-2 whitespace-nowrap">
                  <div class="flex items-center gap-1.5">
                    <a
                      :href="`${JIRA_BASE}/${feature.key}`"
                      target="_blank"
                      rel="noopener"
                      class="font-mono text-xs text-primary-600 dark:text-blue-400 hover:underline"
                      :class="{ 'line-through': feature.scopeChange === 'dropped' }"
                    >{{ feature.key }}</a>
                    <span
                      v-if="feature.scopeChange === 'added'"
                      class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300"
                    >Late Addition</span>
                    <span
                      v-if="feature.scopeChange === 'dropped'"
                      class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                      :title="feature.fixVersionRemovedAt ? 'Removed: ' + formatDate(feature.fixVersionRemovedAt) : 'fixVersion removed'"
                    >Dropped</span>
                  </div>
                </td>

                <!-- Title -->
                <td class="px-3 py-2">
                  <span
                    class="text-sm text-gray-900 dark:text-gray-100"
                    :class="{ 'line-through text-gray-500 dark:text-gray-500': feature.scopeChange === 'dropped' }"
                  >{{ feature.summary }}</span>
                </td>

                <!-- Status Color -->
                <td class="px-3 py-2 text-center">
                  <span
                    v-if="feature.colorStatus"
                    class="inline-block w-3 h-3 rounded-full"
                    :class="colorStatusClass(feature.colorStatus)"
                    :title="feature.colorStatus"
                  />
                  <span v-else class="text-gray-400 text-xs">--</span>
                </td>

                <!-- Status Summary -->
                <td class="px-3 py-2">
                  <div
                    v-if="feature.statusSummary"
                    class="text-xs text-gray-700 dark:text-gray-300 max-w-[200px] truncate"
                    :title="feature.statusSummary?.replace(/<[^>]*>/g, '')"
                    v-html="feature.statusSummary"
                  />
                  <span v-else class="text-gray-400 text-xs">--</span>
                </td>

                <!-- Blocked -->
                <td class="px-3 py-2 text-center">
                  <span
                    v-if="feature.isBlocked"
                    class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30"
                    title="Blocked"
                  >
                    <svg class="w-3.5 h-3.5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </span>
                </td>

                <!-- Components -->
                <td class="px-3 py-2">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="comp in (feature.components || []).slice(0, 3)"
                      :key="comp"
                      class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >{{ comp }}</span>
                    <span
                      v-if="(feature.components || []).length > 3"
                      class="text-[10px] text-gray-400"
                    >+{{ feature.components.length - 3 }}</span>
                  </div>
                </td>

                <!-- Delivery Owner -->
                <td class="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {{ feature.assignee || '--' }}
                </td>

                <!-- PM Owner -->
                <td class="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {{ feature.pmOwner || '--' }}
                </td>
              </tr>
            </template>

            <!-- Empty state for product group -->
            <tr
              v-if="isProductExpanded(portfolioVersion, group.product) && group.features.length === 0"
            >
              <td colspan="8" class="px-8 py-4 text-sm text-gray-500 dark:text-gray-400 italic">
                No features found for {{ group.releaseNumber }}
              </td>
            </tr>
          </template>
        </template>
      </tbody>
    </table>
  </div>
</template>
