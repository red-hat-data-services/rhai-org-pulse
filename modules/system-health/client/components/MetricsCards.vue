<template>
  <div>
    <div v-if="summaryText" class="summary-range">
      {{ summaryText }}
    </div>
    <div class="summary-cards">
      <div class="sc sc-total">
        <div class="sc-label">Total Tests</div>
        <div class="sc-value">{{ totalTests.toLocaleString() }}</div>
        <div class="sc-sub">Sum of all test cases across runs</div>
      </div>
      <div class="sc sc-passed">
        <div class="sc-label">Passed</div>
        <div class="sc-value">{{ totalPassed.toLocaleString() }}</div>
        <div class="sc-sub">Tests that completed successfully</div>
      </div>
      <div class="sc sc-failed">
        <div class="sc-label">Failed</div>
        <div class="sc-value">{{ totalFailed.toLocaleString() }}</div>
        <div class="sc-sub">Tests with assertion failures or errors</div>
      </div>
      <div class="sc sc-skipped">
        <div class="sc-label">Skipped</div>
        <div class="sc-value">{{ totalSkipped.toLocaleString() }}</div>
        <div class="sc-sub">Tests skipped (dependency / scope / disabled)</div>
      </div>
      <div class="sc sc-pct">
        <div class="sc-label">Pass Rate</div>
        <div class="sc-value">{{ passRatePct }}%</div>
        <div class="sc-sub">Passed ÷ Total × 100</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  components: {
    type: Array,
    required: true
  },
  filters: {
    type: Object,
    default: () => ({
      version: 'All',
      release: 'All',
      useDateRange: true,
      fromDate: null,
      toDate: null
    })
  }
})

const totalTests = computed(() => {
  return props.components.reduce((sum, comp) => sum + (comp.overall?.total || 0), 0)
})

const totalPassed = computed(() => {
  return props.components.reduce((sum, comp) => sum + (comp.overall?.passed || 0), 0)
})

const totalFailed = computed(() => {
  return props.components.reduce((sum, comp) => sum + (comp.overall?.failed || 0), 0)
})

const totalSkipped = computed(() => {
  return props.components.reduce((sum, comp) => sum + (comp.overall?.skipped || 0), 0)
})

const passRatePct = computed(() => {
  return totalTests.value > 0 ? Math.round((totalPassed.value / totalTests.value) * 100) : 0
})

const summaryText = computed(() => {
  const parts = []
  
  if (props.filters.version !== 'All') {
    parts.push(`Version: ${props.filters.version}`)
  }
  
  if (props.filters.release !== 'All') {
    parts.push(`Release: ${props.filters.release}`)
  }
  
  if (props.filters.useDateRange && props.filters.fromDate && props.filters.toDate) {
    parts.push(`${friendlyDate(props.filters.fromDate)} – ${friendlyDate(props.filters.toDate)}`)
  } else {
    parts.push('All dates')
  }
  
  parts.push(`${props.components.length} components`)
  
  return parts.length > 0 ? 'Showing: ' + parts.join(' · ') : ''
})

function friendlyDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[d.getMonth()] + ' ' + d.getDate()
}
</script>

<style scoped>
.summary-range {
  display: none;
  margin-bottom: 6px;
  font-size: 12px;
  color: #6b8299;
  padding: 0 2px;
}

.summary-range:empty {
  display: none;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}

.sc {
  background: #0d2137;
  border: 1px solid #1e4976;
  border-radius: 8px;
  padding: 14px 18px;
  border-left: 4px solid;
}

.sc-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #6b8299;
  margin-bottom: 6px;
  font-weight: 600;
}

.sc-value {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
}

.sc-sub {
  font-size: 11px;
  color: #6b8299;
  margin-top: 2px;
}

.sc-total {
  border-left-color: #3498db;
}

.sc-total .sc-value {
  color: #3498db;
}

.sc-passed {
  border-left-color: #2ed573;
}

.sc-passed .sc-value {
  color: #2ed573;
}

.sc-failed {
  border-left-color: #ff4757;
}

.sc-failed .sc-value {
  color: #ff4757;
}

.sc-skipped {
  border-left-color: #ffa502;
}

.sc-skipped .sc-value {
  color: #ffa502;
}

.sc-pct {
  border-left-color: #a29bfe;
}

.sc-pct .sc-value {
  color: #a29bfe;
}

@media (max-width: 1200px) {
  .summary-cards {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .summary-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
