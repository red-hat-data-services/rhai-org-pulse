<template>
  <div class="heatmap-wrapper">
    <table class="heatmap">
      <thead>
        <tr>
          <th class="comp-header">Component</th>
          <th v-for="date in dates" :key="date" class="date-header">
            <div class="date-cell">
              <span>{{ friendlyDate(date) }}</span>
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="comp in components" :key="comp.component">
          <td class="comp-name">
            <a href="#" @click.prevent="$emit('component-click', comp.component)">
              {{ comp.component }}
            </a>
            <div class="comp-stats" v-if="comp.overall">
              {{ passPct(comp.overall.passed, comp.overall.total) }}% · 
              {{ (comp.overall.total || 0).toLocaleString() }} tests
            </div>
          </td>
          <td v-for="date in dates" :key="`${comp.component}-${date}`" class="data-cell">
            <template v-if="comp.days && comp.days[date]">
              <div 
                class="cell"
                :class="`cell-${pctColor(passPct(comp.days[date].passed, comp.days[date].total))}`"
                @mouseenter="activeCell = `${comp.component}-${date}`"
                @mouseleave="activeCell = null"
              >
                <div class="cell-pct" :class="`cell-pct-${pctColor(passPct(comp.days[date].passed, comp.days[date].total))}`">
                  {{ passPct(comp.days[date].passed, comp.days[date].total) }}%
                </div>
                <div class="cell-counts">
                  <span class="cp">{{ comp.days[date].passed }}</span>
                  <span class="cf">{{ comp.days[date].failed }}</span>
                  <span class="cs">{{ comp.days[date].skipped }}</span>
                </div>

                <!-- Hover dropdown -->
                <div 
                  v-if="activeCell === `${comp.component}-${date}`"
                  :class="['cell-dropdown', { 'dd-below': isTopRow(comp) }]"
                >
                  <div class="dd-title">{{ friendlyDate(date) }} · {{ (comp.days[date].jenkins_urls || []).length }} run(s)</div>
                  <div v-if="comp.days[date].by_vr" class="dd-runs">
                    <div 
                      v-for="(vr, vrKey) in comp.days[date].by_vr"
                      :key="vrKey"
                      class="dd-run"
                    >
                      <div class="dd-run-header">
                        <a 
                          v-if="vr.jenkins_urls && vr.jenkins_urls[0]"
                          :href="vr.jenkins_urls[0]"
                          target="_blank"
                          class="dd-run-label"
                        >
                          {{ vrKey }}
                        </a>
                        <span v-else class="dd-run-label">{{ vrKey }}</span>
                        <span class="dd-pct" :class="`cell-pct-${pctColor(passPct(vr.passed, vr.total))}`">
                          {{ passPct(vr.passed, vr.total) }}%
                        </span>
                      </div>
                      <div class="dd-run-counts">
                        <span class="cp">✓{{ vr.passed || 0 }}</span>
                        <span class="cf">✗{{ vr.failed || 0 }}</span>
                        <span class="cs">⊘{{ vr.skipped || 0 }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <template v-else>
              <span class="cell-na">–</span>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  components: {
    type: Array,
    required: true
  }
})

defineEmits(['component-click'])

const activeCell = ref(null)

const dates = computed(() => {
  const dateSet = new Set()
  props.components.forEach(comp => {
    if (comp.days) {
      Object.keys(comp.days).forEach(d => dateSet.add(d))
    }
  })
  return Array.from(dateSet).sort((a, b) => b.localeCompare(a))
})

function passPct(passed, total) {
  return total > 0 ? Math.round((passed / total) * 100) : 0
}

function pctColor(pct) {
  if (pct >= 95) return 'green'
  if (pct >= 80) return 'amber'
  if (pct >= 60) return 'orange'
  return 'red'
}

function friendlyDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[d.getMonth()] + ' ' + d.getDate()
}

function isTopRow(comp) {
  // Show dropdown below for first few components to avoid cutoff
  return props.components.indexOf(comp) < 2
}
</script>

<style scoped>
.heatmap-wrapper {
  overflow-x: auto;
  overflow-y: visible;
  margin-top: 16px;
  position: relative;
}

table.heatmap {
  width: 100%;
  border-collapse: collapse;
  min-width: 800px;
}

table.heatmap th,
table.heatmap td {
  padding: 8px 6px;
  text-align: center;
  border-bottom: 1px solid #1e4976;
  white-space: nowrap;
}

table.heatmap th {
  font-size: 11px;
  color: #8899aa;
  font-weight: 600;
  position: sticky;
  top: 0;
  background: #0a1929;
  z-index: 10;
}

.comp-header {
  text-align: left;
  min-width: 180px;
}

.comp-name {
  text-align: left;
  font-weight: 500;
  padding: 8px 12px;
}

.comp-name a {
  color: #5ea7ff;
  font-size: 13px;
  text-decoration: none;
}

.comp-name a:hover {
  color: #8ec5ff;
  text-decoration: underline;
}

.comp-stats {
  font-size: 10px;
  color: #6b8299;
  margin-top: 2px;
}

.data-cell {
  position: relative;
  padding: 4px 2px;
}

.cell {
  border-radius: 6px;
  padding: 6px 4px;
  min-width: 60px;
  display: inline-block;
  text-align: center;
  cursor: pointer;
  position: relative;
}

.cell-green {
  background: rgba(46, 213, 115, 0.15);
  border: 1px solid rgba(46, 213, 115, 0.3);
}

.cell-amber {
  background: rgba(255, 165, 2, 0.12);
  border: 1px solid rgba(255, 165, 2, 0.25);
}

.cell-orange {
  background: rgba(225, 112, 85, 0.12);
  border: 1px solid rgba(225, 112, 85, 0.25);
}

.cell-red {
  background: rgba(255, 71, 87, 0.12);
  border: 1px solid rgba(255, 71, 87, 0.25);
}

.cell-na {
  color: #4a5568;
  font-size: 13px;
}

.cell-pct {
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}

.cell-pct-green {
  color: #2ed573;
}

.cell-pct-amber {
  color: #ffa502;
}

.cell-pct-orange {
  color: #e17055;
}

.cell-pct-red {
  color: #ff4757;
}

.cell-counts {
  display: flex;
  gap: 3px;
  justify-content: center;
  font-size: 9px;
  font-weight: 600;
  margin-top: 3px;
}

.cell-counts .cp {
  color: #2ed573;
}

.cell-counts .cf {
  color: #ff4757;
}

.cell-counts .cs {
  color: #ffa502;
}

/* Hover dropdown */
.cell-dropdown {
  display: none;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background: #132f4c;
  border: 1px solid #1e4976;
  border-radius: 8px;
  padding: 8px 0;
  z-index: 200;
  min-width: 340px;
  max-height: 360px;
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  text-align: left;
  bottom: calc(100% + 6px);
}

.cell-dropdown.dd-below {
  bottom: auto;
  top: calc(100% + 6px);
}

.dd-title {
  padding: 6px 14px 4px;
  font-size: 10px;
  color: #6b8299;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #1e4976;
  margin-bottom: 4px;
}

.dd-runs {
  max-height: 300px;
  overflow-y: auto;
}

.dd-run {
  padding: 5px 14px;
  border-bottom: 1px solid rgba(30, 73, 118, 0.3);
}

.dd-run:last-child {
  border-bottom: none;
}

.dd-run-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.dd-run-label {
  font-size: 11px;
  color: #5ea7ff;
  text-decoration: none;
}

.dd-run-label:hover {
  text-decoration: underline;
}

.dd-run-counts {
  font-size: 10px;
  display: flex;
  gap: 6px;
}

.dd-pct {
  font-size: 10px;
  font-weight: 700;
  margin-left: auto;
}

.date-header {
  min-width: 80px;
}

.date-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.date-cell span {
  font-size: 11px;
}
</style>
