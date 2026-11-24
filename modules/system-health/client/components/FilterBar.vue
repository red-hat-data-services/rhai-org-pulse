<template>
  <div>
    <div class="filter-bar">
      <div class="filter-group">
        <span class="filter-label">Environment</span>
        <span class="filter-value">RHOAI</span>
      </div>

      <div class="filter-group ver-picker-wrap" ref="pickerWrap">
        <span class="filter-label">Version</span>
        <button
          type="button"
          class="ver-picker-btn"
          :aria-expanded="popoverOpen ? 'true' : 'false'"
          aria-haspopup="listbox"
          @click.stop="togglePopover"
        >
          {{ localFilters.version || 'All' }}
        </button>
        <div
          v-if="popoverOpen"
          class="ver-popover"
          role="dialog"
          aria-label="Select version"
          @click.stop
        >
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="search"
            class="ver-search"
            placeholder="Search version..."
            autocomplete="off"
          >
          <div class="ver-popover-cols">
            <div class="ver-col">
              <div class="ver-col-title">Y-stream</div>
              <button
                type="button"
                class="ver-item"
                :class="{ active: localFilters.version === 'All' }"
                @click="selectVersion('All')"
              >
                All
              </button>
              <button
                v-for="y in filteredYStreams"
                :key="y"
                type="button"
                class="ver-item"
                :class="{ active: activeYStream === y }"
                @click="browseYStream(y)"
              >
                {{ y }}
              </button>
            </div>
            <div class="ver-col">
              <div class="ver-col-title">
                Z-stream{{ activeYStream ? ` · ${activeYStream}` : '' }}
              </div>
              <div v-if="!activeYStream" class="ver-item muted">Select a y-stream</div>
              <template v-else>
                <button
                  v-for="z in filteredZStreams"
                  :key="z"
                  type="button"
                  class="ver-item"
                  :class="{ active: localFilters.version === z }"
                  @click="selectVersion(z)"
                >
                  {{ z === activeYStream ? `${z} (y-stream only)` : z }}
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>

      <div class="filter-group">
        <span class="filter-label">Release</span>
        <div class="rel-row">
          <select
            v-model="localFilters.release"
            :disabled="releaseLocked"
            @change="emitFilters"
          >
            <option value="All">All</option>
            <option v-for="r in releases" :key="r" :value="r">{{ r }}</option>
          </select>
          <span
            v-if="releaseLocked"
            class="rel-lock"
            title="Auto-locked to GA for z-stream versions"
          >🔒</span>
        </div>
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
        <li><strong>Version</strong> — Open the picker: y-stream on the left, z-streams on the right. Search filters both columns. Selection is <em>exact</em>: 3.5 ≡ 3.5.0, but 3.5 does not include 3.5.2.</li>
        <li><strong>Release</strong> — EA1 / EA2 / GA / All. Choosing a <em>z-stream</em> (e.g. 3.5.2) auto-locks Release to <strong>GA</strong>.</li>
        <li><strong>Date Range</strong> — Enable the checkbox to filter by date window. When disabled, all data for selected Version/Release is shown regardless of dates.</li>
        <li><strong>Filter precedence</strong>: Version &amp; Release filter the data first. If Date Range is enabled, it further narrows the window.</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {
  cleanVer,
  isZStream,
  yStreamVer,
  yStreamList,
  zStreamList
} from '../utils/versionFilter.js'

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
const popoverOpen = ref(false)
const searchQuery = ref('')
const activeYStream = ref(null)
const pickerWrap = ref(null)
const searchInput = ref(null)

const releaseLocked = computed(() => isZStream(localFilters.value.version))

const filteredYStreams = computed(() => {
  const q = String(searchQuery.value || '').trim().toLowerCase()
  let ys = yStreamList(props.versions)
  if (q) {
    ys = ys.filter(
      (y) =>
        y.includes(q) ||
        zStreamList(props.versions, y).some((z) => z.toLowerCase().includes(q))
    )
  }
  return ys
})

const filteredZStreams = computed(() => {
  if (!activeYStream.value) return []
  const q = String(searchQuery.value || '').trim().toLowerCase()
  let zs = zStreamList(props.versions, activeYStream.value)
  if (q) {
    zs = zs.filter(
      (z) => z.toLowerCase().includes(q) || activeYStream.value.includes(q)
    )
  }
  return zs
})

function applyReleaseLock(version) {
  if (isZStream(version)) {
    localFilters.value.release = 'GA'
  }
}

function syncFromProps(newFilters) {
  const raw = newFilters?.version ?? 'All'
  const ver = raw === 'All' ? 'All' : cleanVer(raw)
  localFilters.value = {
    ...newFilters,
    version: ver,
    release: isZStream(ver) ? 'GA' : (newFilters?.release ?? 'All')
  }
  activeYStream.value = ver === 'All' ? null : yStreamVer(ver)
}

watch(() => props.filters, (newFilters) => {
  syncFromProps(newFilters)
}, { deep: true, immediate: true })

function emitFilters() {
  applyReleaseLock(localFilters.value.version)
  emit('filters-change', { ...localFilters.value })
}

function togglePopover() {
  popoverOpen.value = !popoverOpen.value
  if (popoverOpen.value) {
    searchQuery.value = ''
    const ver = localFilters.value.version
    activeYStream.value = ver === 'All' ? null : yStreamVer(ver)
    nextTick(() => searchInput.value?.focus())
  }
}

function closePopover() {
  popoverOpen.value = false
  searchQuery.value = ''
}

function browseYStream(y) {
  activeYStream.value = y
}

function selectVersion(v) {
  const ver = v || 'All'
  localFilters.value.version = ver
  activeYStream.value = ver === 'All' ? null : yStreamVer(ver)
  applyReleaseLock(ver)
  closePopover()
  emitFilters()
}

function onDocClick(e) {
  if (pickerWrap.value && !pickerWrap.value.contains(e.target)) {
    closePopover()
  }
}

function onKeydown(e) {
  if (e.key === 'Escape') closePopover()
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)

  if (!localFilters.value.fromDate || !localFilters.value.toDate) {
    const today = new Date()
    const from = new Date(today)
    from.setDate(today.getDate() - 30)
    localFilters.value.fromDate = formatDate(from)
    localFilters.value.toDate = formatDate(today)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})

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
input[type="date"],
.ver-picker-btn {
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
input[type="date"]:hover,
.ver-picker-btn:hover {
  border-color: var(--te-accent);
}

select:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(1);
  cursor: pointer;
}

.ver-picker-wrap {
  position: relative;
}

.ver-picker-btn {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 120px;
  text-align: left;
}

.ver-picker-btn::after {
  content: '▾';
  font-size: 10px;
  color: var(--te-text-muted);
}

.ver-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 300;
  background: var(--te-surface-input);
  border: 1px solid var(--te-border);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
  width: 420px;
  padding: 10px;
  text-align: left;
}

.ver-search {
  width: 100%;
  background: var(--te-surface-input);
  color: var(--te-heading);
  border: 1px solid var(--te-border);
  border-radius: 4px;
  padding: 8px 10px;
  font-size: 12px;
  margin-bottom: 8px;
  outline: none;
  box-sizing: border-box;
}

.ver-search:focus {
  border-color: var(--te-accent);
}

.ver-popover-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  max-height: 280px;
}

.ver-col {
  overflow-y: auto;
  border: 1px solid var(--te-border);
  border-radius: 6px;
  background: var(--te-help-bg);
  max-height: 260px;
}

.ver-col-title {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--te-sc-label);
  padding: 6px 10px 4px;
  font-weight: 700;
  border-bottom: 1px solid var(--te-border);
  position: sticky;
  top: 0;
  background: var(--te-help-bg);
}

.ver-item {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: 0;
  color: var(--te-text-muted);
  padding: 7px 10px;
  font-size: 12px;
  cursor: pointer;
}

.ver-item:hover {
  background: var(--te-surface-input);
  color: var(--te-heading);
}

.ver-item.active {
  background: var(--te-border);
  color: var(--te-heading);
  font-weight: 600;
}

.ver-item.active::after {
  content: ' ✓';
  color: var(--te-accent);
}

.ver-item.muted {
  color: var(--te-sc-label);
  cursor: default;
}

.rel-row {
  display: flex;
  align-items: center;
}

.rel-lock {
  margin-left: 6px;
  font-size: 12px;
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
