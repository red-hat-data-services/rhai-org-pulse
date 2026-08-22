<template>
  <div class="relative" style="height: 240px;">
    <Doughnut v-if="hasData" :data="chartData" :options="chartOptions" ref="chartRef" />
    <div v-if="hasData" class="absolute inset-0 flex items-center justify-center pointer-events-none" style="z-index: 1;">
      <div class="text-center">
        <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ overallPct }}%</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">TFA Complete</p>
      </div>
    </div>
    <!-- External HTML tooltip -->
    <div v-if="tooltip.visible" class="absolute bg-gray-900 text-white rounded-lg shadow-xl pointer-events-none" style="z-index: 10; min-width: 180px;" :style="tooltipStyle">
      <div class="px-3 py-2 border-b border-gray-700">
        <p class="font-bold text-sm">{{ tooltip.title }}</p>
      </div>
      <div class="px-3 py-2 space-y-1.5 text-xs">
        <div v-for="row in tooltip.rows" :key="row.key" class="flex justify-between gap-4">
          <span class="text-gray-400">{{ row.key }}</span>
          <span class="font-medium" :class="row.cls || ''">{{ row.value }}</span>
        </div>
      </div>
      <div class="px-3 py-1.5 border-t border-gray-700 text-center text-gray-500 text-xs">Click to expand</div>
    </div>
    <div v-if="!hasData" class="flex items-center justify-center h-full">
      <p class="text-sm text-gray-400 dark:text-gray-500">No TFA data</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, reactive } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip
} from 'chart.js'
import { getPillarColor } from '../composables/pillarColors.js'

ChartJS.register(ArcElement, Tooltip)

var DONE_COLOR = { bg: 'rgba(16, 185, 129, 0.8)', border: 'rgb(16, 185, 129)' }
var REMAINING_COLOR = { bg: 'rgba(239, 68, 68, 0.7)', border: 'rgb(239, 68, 68)' }

var RISK_LABELS = { green: 'On Track', yellow: 'At Risk', red: 'Likely Blocker' }
var RISK_COLORS = { green: 'text-emerald-400', yellow: 'text-amber-400', red: 'text-red-400' }

var props = defineProps({
  pillarData: { type: Array, required: true },
  overallPct: { type: Number, required: true },
  overallDone: { type: Number, default: 0 },
  overallTotal: { type: Number, default: 0 },
  selectedPillar: { type: String, default: null }
})

var emit = defineEmits(['select-pillar', 'select-status'])

var chartRef = ref(null)
var tooltip = reactive({ visible: false, title: '', rows: [], x: 0, y: 0 })

var tooltipStyle = computed(function () {
  return {
    left: tooltip.x + 'px',
    top: Math.max(0, tooltip.y - 12) + 'px',
    transform: 'translate(-50%, -100%)'
  }
})

var hasData = computed(function () {
  return props.pillarData && props.pillarData.length > 0
})

var overallRemaining = computed(function () {
  return Math.max(0, props.overallTotal - props.overallDone)
})

var chartData = computed(function () {
  var outerLabels = []
  var outerData = []
  var outerBg = []
  var outerHover = []

  for (var i = 0; i < props.pillarData.length; i++) {
    var p = props.pillarData[i]
    outerLabels.push(p.pillarName)
    outerData.push(p.total || 1)
    var color = getPillarColor(p.pillarName)
    var isSelected = props.selectedPillar === p.pillarName
    outerBg.push(isSelected ? color.border : color.bg)
    outerHover.push(color.border)
  }

  return {
    labels: outerLabels.concat(['Done', 'Remaining']),
    datasets: [
      {
        label: 'Pillars',
        data: outerData,
        backgroundColor: outerBg,
        hoverBackgroundColor: outerHover,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.9)',
        hoverOffset: 6,
        weight: 3
      },
      {
        label: 'Completion',
        data: [props.overallDone, overallRemaining.value],
        backgroundColor: [DONE_COLOR.bg, REMAINING_COLOR.bg],
        hoverBackgroundColor: [DONE_COLOR.border, REMAINING_COLOR.border],
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.9)',
        hoverOffset: 4,
        weight: 1.5
      }
    ]
  }
})

var chartOptions = computed(function () {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '50%',
    spacing: 4,
    onHover: function (event, elements) {
      var canvas = event.native && event.native.target
      if (canvas) canvas.style.cursor = elements.length > 0 ? 'pointer' : 'default'
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: function (context) {
          var model = context.tooltip
          if (model.opacity === 0) {
            tooltip.visible = false
            return
          }
          var dp = model.dataPoints && model.dataPoints[0]
          if (!dp) { tooltip.visible = false; return }

          var dsIdx = dp.datasetIndex
          var idx = dp.dataIndex

          if (dsIdx === 0) {
            var p = props.pillarData[idx]
            if (!p) { tooltip.visible = false; return }
            tooltip.title = p.pillarName
            tooltip.rows = [
              { key: 'Sign-offs', value: p.done + ' / ' + p.total },
              { key: 'Completion', value: p.pct + '%' },
              { key: 'Failed open', value: String(p.failedOpen), cls: p.failedOpen > 0 ? 'text-red-400' : '' },
              { key: 'Risk', value: RISK_LABELS[p.riskLevel] || 'Unknown', cls: RISK_COLORS[p.riskLevel] || '' }
            ]
          } else {
            var label = idx === 0 ? 'Done' : 'Remaining'
            var count = idx === 0 ? props.overallDone : overallRemaining.value
            tooltip.title = 'TFA Sign-offs — ' + label
            tooltip.rows = [
              { key: 'Count', value: String(count) },
              { key: 'Of total', value: String(props.overallTotal) },
              { key: 'Percentage', value: (idx === 0 ? props.overallPct : (100 - props.overallPct)) + '%' }
            ]
          }

          tooltip.x = model.caretX
          tooltip.y = model.caretY
          tooltip.visible = true
        }
      }
    },
    onClick: function (event, elements) {
      if (!elements || !elements.length) return
      var el = elements[0]
      var dsIdx = el.datasetIndex
      var idx = el.index

      if (dsIdx === 0) {
        var pillarName = props.pillarData[idx] ? props.pillarData[idx].pillarName : null
        if (pillarName) emit('select-pillar', pillarName)
      } else {
        emit('select-status', idx === 0 ? 'done' : 'remaining')
      }
    }
  }
})
</script>
