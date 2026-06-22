<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Post-Release Defects</h1>
      <button
        v-if="isAdmin"
        @click="handleRefresh"
        :disabled="refreshing"
        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

      <div v-if="selectedVersions.length > 0" class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
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
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useAuth } from '@shared/client/composables/useAuth';
import VersionSelector from '../quality-components/VersionSelector.vue';
import ComponentFilter from '../quality-components/ComponentFilter.vue';
import CumulativeBugChart from '../quality-components/CumulativeBugChart.vue';
import { getVersions, getBugData, getComponents, refreshData } from '../quality-services/api';
import { extractProduct } from '../composables/release-utils';

const { isAdmin } = useAuth();

const versions = ref([]);
const allComponents = ref([]);
const selectedProduct = ref('');
const selectedVersions = ref([]);
const selectedComponent = ref(null);
const chartData = ref({ labels: [], datasets: [] });
const loading = ref(true);
const refreshing = ref(false);
const error = ref(null);

const products = computed(() => {
  const productSet = new Set();
  for (const v of versions.value) {
    const p = extractProduct(v.name);
    if (p) productSet.add(p);
  }
  return Array.from(productSet).sort();
});

// Filter versions by selected product
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

    // Load all components with bug counts
    allComponents.value = await getComponents();

    // Load all versions (no component filter initially)
    versions.value = await getVersions();

    // Auto-select first 3 versions with bugs from all products
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
});

// Watch component filter - refetch chart data when component changes
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

    // Reload components with fresh bug counts
    allComponents.value = await getComponents();

    // Reload versions with fresh bug counts
    versions.value = await getVersions();

    // Refetch chart data if versions are selected
    if (selectedVersions.value.length > 0) {
      const response = await getBugData(selectedVersions.value, selectedComponent.value);
      chartData.value = { labels: response.labels, datasets: response.datasets };
    }
  } catch (err) {
    console.error('[quality] Failed to refresh data:', err);
    error.value = err.message || 'Failed to refresh quality metrics data';
  } finally {
    refreshing.value = false;
  }
}
</script>
