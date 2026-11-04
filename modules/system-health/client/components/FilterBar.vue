<template>
  <div>
    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-label">Environment</span>
        <span class="filter-value">RHOAI</span>
      </div>
      <div class="filter-group">
        <span class="filter-label">Version</span>
        <select v-model="localFilters.version" @change="emitFilters">
          <option value="All">All</option>
          <option v-for="v in versions" :key="v" :value="v">{{ v }}</option>
        </select>
      </div>
      <div class="filter-group">
        <span class="filter-label">Release</span>
        <select v-model="localFilters.release" @change="emitFilters">
          <option value="All">All</option>
          <option v-for="r in releases" :key="r" :value="r">{{ r }}</option>
        </select>
      </div>
      <div class="filter-group filter-group--divider">
        <span class="filter-label">Date Range</span>
        <label class="date-toggle-label">
          <input 
            v-model="localFilters.useDateRange" 
            type="checkbox" 
            class="date-toggle-input"
            @change="emitFilters"
          >
          <span>Enable</span>
        </label>
      </div>
      <div v-if="localFilters.useDateRange" class="filter-group">
        <span class="filter-label">From</span>
        <input 
          v-model="localFilters.fromDate" 
          type="date" 
          @change="emitFilters"
        >
      </div>
      <div v-if="localFilters.useDateRange" class="filter-group">
        <span class="filter-label">To</span>
        <input 
          v-model="localFilters.toDate" 
          type="date" 
          @change="emitFilters"
        >
      </div>
    </div>

    <div class="help-box" style="margin-bottom: 20px; margin-top: 20px">
      <h4>ℹ️ How to use filters</h4>
      <ul>
        <li><strong>Version</strong> — Select a specific RHOAI version (e.g., 3.5, 3.6) or "All" to view all versions combined.</li>
        <li><strong>Release</strong> — Filter by release milestone: <strong>GA</strong> (General Availability, production-ready), <strong>EA1</strong> (1st Early Access), <strong>EA2</strong> (2nd Early Access, closer to GA), or "All" for the complete picture.</li>
        <li><strong>Date Range</strong> — Enable the checkbox to filter by date window. When disabled, all data for selected Version/Release is shown regardless of dates.</li>
        <li><strong>Filter precedence</strong>: Version & Release filter the data first. If Date Range is enabled, it further narrows the window.</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  filters: {
    type: Object,
    default: () => ({
      version: 'All',
      release: 'All',
      useDateRange: true,
      fromDate: null,
      toDate: null
    })
  },
  versions: {
    type: Array,
    default: () => []
  },
  releases: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['filters-change'])

const localFilters = ref({ ...props.filters })

watch(() => props.filters, (newFilters) => {
  localFilters.value = { ...newFilters }
}, { deep: true })

function emitFilters() {
  emit('filters-change', { ...localFilters.value })
}

// Set default dates if not provided
if (!localFilters.value.fromDate || !localFilters.value.toDate) {
  const today = new Date()
  const from = new Date(today)
  from.setDate(today.getDate() - 30)
  
  localFilters.value.fromDate = formatDate(from)
  localFilters.value.toDate = formatDate(today)
}

function formatDate(d) {
  return d.toISOString().slice(0, 10)
}
</script>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin: 18px 0 24px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.filter-label {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--te-sc-label);
  letter-spacing: 0.5px;
  font-weight: 600;
}

.filter-value {
  font-size: 13px;
  color: var(--te-heading);
  font-weight: 500;
}

.filter-group--divider {
  border-left: 1px solid var(--te-border);
  padding-left: 12px;
  margin-left: 4px;
}

.date-toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 11px;
  color: var(--te-toggle-text);
}

.date-toggle-input {
  accent-color: var(--te-accent);
  width: 14px;
  height: 14px;
}

select,
input[type="date"] {
  background: var(--te-surface-input);
  color: var(--te-heading);
  border: 1px solid var(--te-border);
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
  outline: none;
  min-width: 100px;
  appearance: auto;
  -webkit-appearance: auto;
}

select:hover,
input[type="date"]:hover {
  border-color: var(--te-accent);
}

.help-box {
  background: var(--te-help-bg);
  border: 1px solid var(--te-help-border);
  border-radius: 8px;
  padding: 14px 18px;
}

.help-box h4 {
  font-size: 13px;
  color: var(--te-accent);
  margin-bottom: 6px;
}

.help-box p,
.help-box li {
  font-size: 12px;
  color: var(--te-text-muted);
  line-height: 1.6;
}

.help-box ul {
  padding-left: 18px;
  margin-top: 4px;
}
</style>
