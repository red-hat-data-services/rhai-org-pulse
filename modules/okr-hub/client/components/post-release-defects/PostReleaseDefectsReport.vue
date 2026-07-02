<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div></div>
      <button
        v-if="isAdmin"
        @click="handleRefresh"
        :disabled="refreshing"
        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {{ refreshing ? 'Refreshing...' : 'Refresh Data' }}
      </button>
    </div>

    <div v-if="error" class="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700/60 text-red-700 dark:text-red-300 px-4 py-3 text-sm mb-6">
      {{ error }}
    </div>

    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400 mb-6">
      Loading quality metrics...
    </div>

    <template v-else>
      <!-- Stepped Filter Interface - Horizontal -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Step 1: Product Selection -->
          <div class="relative">
            <div class="flex items-center gap-2 mb-3">
              <div class="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-semibold flex-shrink-0">
                1
              </div>
              <h3 class="text-base font-semibold">Product</h3>
            </div>
            <div class="pl-9">
              <select
                v-model="selectedProduct"
                class="w-full px-3 py-2 text-sm border-2 rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900"
              >
                <option value="">All Products</option>
                <option v-for="product in products" :key="product" :value="product">
                  {{ product.toUpperCase() }}
                </option>
              </select>
            </div>
            <!-- Horizontal connector -->
            <div class="hidden lg:block absolute top-3 -right-3 w-6 h-0.5 bg-gray-300 dark:bg-gray-600"></div>
          </div>

          <!-- Step 2: Version Selection (only if product selected or versions exist) -->
          <div v-if="selectedProduct || filteredVersions.length > 0" class="relative">
            <div class="flex items-center gap-2 mb-3">
              <div class="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-semibold flex-shrink-0">
                2
              </div>
              <h3 class="text-base font-semibold">Versions <span class="text-xs font-normal text-gray-500">(max 6)</span></h3>
            </div>
            <div class="pl-9">
              <VersionSelector
                v-model="selectedVersions"
                :versions="filteredVersions"
                :max-selections="6"
              />
            </div>
            <!-- Horizontal connector -->
            <div class="hidden lg:block absolute top-3 -right-3 w-6 h-0.5 bg-gray-300 dark:bg-gray-600"></div>
          </div>

          <!-- Step 3: Component Filter (optional) -->
          <div v-if="selectedVersions.length > 0 || selectedComponent" class="relative">
            <div class="flex items-center gap-2 mb-3">
              <div class="flex items-center justify-center w-7 h-7 rounded-full bg-gray-400 dark:bg-gray-600 text-white text-sm font-semibold flex-shrink-0">
                3
              </div>
              <h3 class="text-base font-semibold">Component <span class="text-xs font-normal text-gray-500">(optional)</span></h3>
            </div>
            <div class="pl-9">
              <ComponentFilter
                v-model="selectedComponent"
                :components="allComponents"
              />
            </div>
          </div>
        </div>
      </div>

      <div v-if="selectedVersions.length > 0" class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 class="text-lg font-semibold mb-4">Cumulative Bug Count vs Days Since Release</h2>
        <div class="h-96">
          <CumulativeBugChart
            :labels="chartData.labels"
            :datasets="chartData.datasets"
          />
        </div>
      </div>

      <div v-else class="text-center py-12 text-gray-500 dark:text-gray-400">
        <p>Select versions to view cumulative bug trends</p>
      </div>

      <div v-if="selectedVersions.length > 0" class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 class="text-lg font-semibold mb-4">Summary Statistics</h2>
        <table class="w-full">
          <thead>
            <tr class="border-b dark:border-gray-700">
              <th class="text-left py-2">Version</th>
              <th class="text-right py-2">Total Bugs</th>
              <th class="text-right py-2">Days Tracked</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(dataset, i) in chartData.datasets" :key="i" class="border-b dark:border-gray-700">
              <td class="py-2">{{ dataset.label }}</td>
              <td class="text-right">{{ lastValue(dataset.data) }}</td>
              <td class="text-right">{{ lastIndex(dataset.data) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 90-Day Post-Release Bug Tracking -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div class="flex items-center justify-between mb-1">
          <h2 class="text-lg font-semibold">90-Day Post-Release Bug Tracking</h2>
          <button
            v-if="canEdit"
            @click="showTrackingSettings = !showTrackingSettings"
            class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Configure versions"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-5">Bugs created within 90 days of each version's GA date. Versions under 90 days show elapsed days.</p>

        <!-- Settings Panel -->
        <div v-if="showTrackingSettings" class="mb-6 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 p-4">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Version Configuration</h3>
            <div class="flex items-center gap-2">
              <button
                @click="addRelease"
                class="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
              >+ Add Release</button>
              <button
                @click="saveTrackingConfig"
                :disabled="savingConfig"
                class="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >{{ savingConfig ? 'Saving...' : 'Save & Reload' }}</button>
            </div>
          </div>

          <div v-if="configError" class="text-xs text-red-600 dark:text-red-400 mb-3">{{ configError }}</div>

          <div class="space-y-4">
            <div v-for="(rel, ri) in editableConfig" :key="ri" class="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-3">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Release</label>
                  <input
                    v-model="rel.version"
                    class="w-20 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                    placeholder="3.4"
                  />
                </div>
                <div class="flex items-center gap-1">
                  <button
                    @click="addProduct(ri)"
                    class="px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors"
                  >+ Version</button>
                  <button
                    @click="removeRelease(ri)"
                    class="px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >Remove</button>
                </div>
              </div>
              <div class="space-y-1.5">
                <div v-for="(p, pi) in rel.products" :key="pi" class="flex items-center gap-2">
                  <input
                    v-model="p.name"
                    class="flex-1 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                    placeholder="e.g. rhoai-3.4"
                  />
                  <input
                    v-model="p.gaDate"
                    type="date"
                    class="px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  />
                  <button
                    @click="removeProduct(ri, pi)"
                    class="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Remove version"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="editableConfig.length === 0" class="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
            No release configuration. Click "+ Add Release" to get started, or close settings to use auto-detected versions.
          </div>

          <div class="mt-3 flex items-center justify-between">
            <button
              v-if="editableConfig.length > 0"
              @click="clearConfig"
              class="px-3 py-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            >Clear All (use auto-detected)</button>
            <span v-else></span>
            <span class="text-xs text-gray-400">Version names map to Jira affectedVersion field</span>
          </div>
        </div>

        <div v-if="trackingLoading" class="text-sm text-gray-500 dark:text-gray-400">Loading 90-day tracking data...</div>
        <div v-else-if="trackingError" class="text-sm text-red-600 dark:text-red-400">{{ trackingError }}</div>
        <div v-else-if="trackingData.length === 0" class="text-sm text-gray-500 dark:text-gray-400">No release data available.</div>

        <div v-else class="space-y-3">
          <div v-for="rel in trackingData" :key="rel.version" class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              class="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors text-left"
              @click="toggleTracking(rel.version)"
            >
              <div class="flex items-center gap-2">
                <svg
                  class="w-4 h-4 text-gray-400 transition-transform duration-200"
                  :class="{ 'rotate-90': isTrackingOpen(rel.version) }"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span class="font-semibold text-sm text-gray-900 dark:text-gray-100">Release {{ rel.version }}</span>
                <span v-if="!rel.isAllComplete" class="text-xs text-amber-600 dark:text-amber-400 font-medium">({{ rel.maxDaysElapsed }} days)</span>
              </div>
              <span class="text-sm font-bold" :class="rel.total > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'">{{ rel.total }} bugs</span>
            </button>

            <div v-show="isTrackingOpen(rel.version)">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-t border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
                    <th class="text-left px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Version</th>
                    <th class="text-right px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Bug Count</th>
                    <th class="text-right px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Days Elapsed</th>
                    <th class="text-right px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in rel.products" :key="p.name" class="border-b border-gray-100 dark:border-gray-800">
                    <td class="px-4 py-2 text-gray-900 dark:text-gray-100">{{ p.name }}</td>
                    <td class="text-right px-4 py-2 font-medium" :class="p.bugCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'">{{ p.bugCount }}</td>
                    <td class="text-right px-4 py-2 text-gray-600 dark:text-gray-400">{{ p.daysElapsed }} / 90</td>
                    <td class="text-right px-4 py-2">
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        :class="p.isComplete ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'"
                      >{{ p.isComplete ? 'Complete' : 'In Progress' }}</span>
                    </td>
                  </tr>
                  <tr class="bg-gray-50 dark:bg-gray-800/40 font-semibold">
                    <td class="px-4 py-2 text-gray-900 dark:text-gray-100">Total</td>
                    <td class="text-right px-4 py-2" :class="rel.total > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'">{{ rel.total }}</td>
                    <td class="text-right px-4 py-2 text-gray-600 dark:text-gray-400"></td>
                    <td class="text-right px-4 py-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useAuth } from '@shared/client/composables/useAuth';
import { useOkrPermissions } from '../../composables/useOkrPermissions';
import VersionSelector from './VersionSelector.vue';
import ComponentFilter from './ComponentFilter.vue';
import CumulativeBugChart from './CumulativeBugChart.vue';
import { getVersions, getBugData, getComponents, refreshData, get90DaySummary, get90DayTrackingConfig, save90DayTrackingConfig } from './api';
import { extractProduct } from './release-utils';

const { isAdmin } = useAuth();
const { canEdit } = useOkrPermissions();

const versions = ref([]);
const allComponents = ref([]);
const selectedProduct = ref('');
const selectedVersions = ref([]);
const selectedComponent = ref(null);
const chartData = ref({ labels: [], datasets: [] });
const loading = ref(true);
const refreshing = ref(false);
const error = ref(null);

const trackingData = ref([]);
const trackingLoading = ref(true);
const trackingError = ref(null);
const openTrackingSections = ref({});

const showTrackingSettings = ref(false);
const trackingConfig = ref(null);
const editableConfig = ref([]);
const savingConfig = ref(false);
const configError = ref(null);

const products = computed(() => {
  const productSet = new Set();
  for (const v of versions.value) {
    const p = extractProduct(v.name);
    if (p) productSet.add(p);
  }
  return Array.from(productSet).sort();
});

const filteredVersions = computed(() => {
  if (!selectedProduct.value) return versions.value;
  return versions.value.filter(v =>
    v.name.toLowerCase().startsWith(selectedProduct.value + '-')
  );
});

watch(selectedProduct, () => {
  selectedVersions.value = [];
  selectedComponent.value = null;
});

onMounted(async () => {
  try {
    error.value = null;
    loading.value = true;

    allComponents.value = await getComponents();
    versions.value = await getVersions();

    const versionsWithBugs = versions.value.filter(v => v.bugCount > 0);
    if (versionsWithBugs.length > 0) {
      selectedVersions.value = versionsWithBugs.slice(0, 3).map(v => v.name);
    }
  } catch (err) {
    console.error('[quality] Failed to load initial data:', err);
    error.value = err.message || 'Failed to load quality metrics data';
  } finally {
    loading.value = false;
  }

  load90DayTracking();
});

async function load90DayTracking() {
  try {
    trackingLoading.value = true;
    trackingError.value = null;

    // Load saved config
    try {
      const cfg = await get90DayTrackingConfig();
      trackingConfig.value = cfg;
      if (cfg && cfg.releases && cfg.releases.length > 0) {
        editableConfig.value = JSON.parse(JSON.stringify(cfg.releases));
      }
    } catch (cfgErr) { // eslint-disable-line no-unused-vars
      trackingConfig.value = null;
    }

    const configToSend = trackingConfig.value && trackingConfig.value.releases && trackingConfig.value.releases.length > 0
      ? trackingConfig.value
      : null;
    const result = await get90DaySummary(configToSend);
    const releases = result.releases || [];
    for (const rel of releases) {
      rel.isAllComplete = rel.products.every(function(p) { return p.isComplete; });
      rel.maxDaysElapsed = 0;
      for (const p of rel.products) {
        if (p.daysElapsed > rel.maxDaysElapsed) rel.maxDaysElapsed = p.daysElapsed;
      }
    }
    trackingData.value = releases;
    if (releases.length > 0) {
      openTrackingSections.value[releases[0].version] = true;
    }
  } catch (err) {
    console.error('[quality] Failed to load 90-day tracking:', err);
    trackingError.value = err.message || 'Failed to load 90-day tracking data';
  } finally {
    trackingLoading.value = false;
  }
}

function toggleTracking(version) {
  openTrackingSections.value[version] = !openTrackingSections.value[version];
}

function isTrackingOpen(version) {
  return !!openTrackingSections.value[version];
}

function addRelease() {
  editableConfig.value.push({ version: '', products: [
    { name: '', gaDate: '' },
    { name: '', gaDate: '' },
    { name: '', gaDate: '' }
  ]});
}

function removeRelease(ri) {
  editableConfig.value.splice(ri, 1);
}

function addProduct(ri) {
  editableConfig.value[ri].products.push({ name: '', gaDate: '' });
}

function removeProduct(ri, pi) {
  editableConfig.value[ri].products.splice(pi, 1);
}

async function saveTrackingConfig() {
  try {
    savingConfig.value = true;
    configError.value = null;
    // Filter out empty entries
    const cleaned = editableConfig.value
      .filter(function(r) { return r.version; })
      .map(function(r) {
        return {
          version: r.version,
          products: r.products.filter(function(p) { return p.name && p.gaDate; })
        };
      })
      .filter(function(r) { return r.products.length > 0; });

    const payload = { releases: cleaned };
    await save90DayTrackingConfig(payload);
    trackingConfig.value = payload;
    showTrackingSettings.value = false;
    await load90DayTracking();
  } catch (err) {
    console.error('[quality] Failed to save tracking config:', err);
    configError.value = err.message || 'Failed to save configuration';
  } finally {
    savingConfig.value = false;
  }
}

async function clearConfig() {
  try {
    savingConfig.value = true;
    configError.value = null;
    await save90DayTrackingConfig({ releases: [] });
    trackingConfig.value = null;
    editableConfig.value = [];
    showTrackingSettings.value = false;
    await load90DayTracking();
  } catch (err) {
    console.error('[quality] Failed to clear tracking config:', err);
    configError.value = err.message || 'Failed to clear configuration';
  } finally {
    savingConfig.value = false;
  }
}

watch(selectedComponent, async () => {
  try {
    error.value = null;

    if (selectedVersions.value.length > 0) {
      const response = await getBugData(selectedVersions.value, selectedComponent.value);
      chartData.value = { labels: response.labels, datasets: response.datasets };
    }
  } catch (err) {
    console.error('[quality] Failed to filter by component:', err);
    error.value = err.message || 'Failed to filter chart data by component';
  }
});

watch(selectedVersions, async () => {
  try {
    error.value = null;

    if (selectedVersions.value.length > 0) {
      const response = await getBugData(selectedVersions.value, selectedComponent.value);
      chartData.value = { labels: response.labels, datasets: response.datasets };
    } else {
      chartData.value = { labels: [], datasets: [] };
    }
  } catch (err) {
    console.error('[quality] Failed to load bug data:', err);
    error.value = err.message || 'Failed to load bug data for selected versions';
  }
}, { deep: true });

function lastValue(data) {
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i] !== null) return data[i];
  }
  return 0;
}

function lastIndex(data) {
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i] !== null) return i;
  }
  return 0;
}

async function handleRefresh() {
  try {
    error.value = null;
    refreshing.value = true;

    await refreshData();

    allComponents.value = await getComponents();
    versions.value = await getVersions();

    if (selectedVersions.value.length > 0) {
      const response = await getBugData(selectedVersions.value, selectedComponent.value);
      chartData.value = { labels: response.labels, datasets: response.datasets };
    }

    load90DayTracking();
  } catch (err) {
    console.error('[quality] Failed to refresh data:', err);
    error.value = err.message || 'Failed to refresh quality metrics data';
  } finally {
    refreshing.value = false;
  }
}
</script>
