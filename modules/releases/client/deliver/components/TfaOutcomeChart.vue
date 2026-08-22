<template>
  <div class="relative mx-auto" style="width: 180px; height: 180px;">
    <Doughnut v-if="hasData" :data="chartData" :options="chartOptions" />
    <div v-if="hasData" class="absolute inset-0 flex items-center justify-center pointer-events-none" style="z-index: 1;">
      <div class="text-center">
        <p class="text-base font-bold text-gray-900 dark:text-gray-100">{{ resolvedPct }}%</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">Resolved</p>
      </div>
    </div>
    <!-- External HTML tooltip -->
    <div v-if="tooltip.visible" class="absolute bg-gray-900 text-white rounded-lg shadow-xl pointer-events-none" style="z-index: 10; min-width: 170px;" :style="tooltipStyle">
      <div class="px-3 py-2 border-b border-gray-700">
        <p class="font-bold text-sm">{{ tooltip.title }}</p>
      </div>
      <div class="px-3 py-2 space-y-1.5 text-xs">
        <div v-for="row in tooltip.rows" :key="row.key" class="flex justify-between gap-4">
          <span class="text-gray-400">{{ row.key }}</span>
          <span class="font-medium" :class="row.cls || ''">{{ row.value }}</span>
        </div>
      </div>
      <div class="px-3 py-1.5 border-t border-gray-700 text-center text-gray-500 text-xs">Click to filter pillars</div>
    </div>
    <div v-if="!hasData" class="flex items-center justify-center h-full">
      <p class="text-xs text-gray-400 dark:text-gray-500">No outcome data</p>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip)

var props = defineProps({
  signoffDone: { type: Number, default: 0 },
  failedOpen: { type: Number, default: 0 }
})

var emit = defineEmits(['select-outcome'])

var tooltip = reactive({ visible: false, title: '', rows: [], x: 0, y: 0 })

var tooltipStyle = computed(function () {
  return {
    left: tooltip.x + 'px',
    top: Math.max(0, tooltip.y - 12) + 'px',
    transform: 'translate(-50%, -100%)'
  }
})

var total = computed(function () {
  return props.signoffDone + props.failedOpen
})

var resolvedPct = computed(function () {
  if (total.value === 0) return 0
  return Math.round((props.signoffDone / total.value) * 100)
})

var hasData = computed(function () {
  return total.value > 0
})

var chartData = computed(function () {
  return {
    labels: ['Sign-offs Done', 'Failed Open'],
    datasets: [{
      data: [props.signoffDone, props.failedOpen],
      backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(239, 68, 68, 0.7)'],
      hoverBackgroundColor: ['rgb(16, 185, 129)', 'rgb(239, 68, 68)'],
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.9)',
      hoverOffset: 6
    }]
  }
})

var chartOptions = computed(function () {
  return {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '58%',
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

          var idx = dp.dataIndex
          var isDone = idx === 0
          var count = isDone ? props.signoffDone : props.failedOpen
          var pct = total.value > 0 ? Math.round((count / total.value) * 100) : 0

          tooltip.title = isDone ? 'Sign-offs Done' : 'Failed Tests Open'
          tooltip.rows = [
            { key: 'Count', value: String(count) },
            { key: 'Of total', value: String(total.value) },
            { key: 'Share', value: pct + '%', cls: isDone ? 'text-emerald-400' : 'text-red-400' }
          ]
          tooltip.x = model.caretX
          tooltip.y = model.caretY
          tooltip.visible = true
        }
      }
    },
    onClick: function (event, elements) {
      if (!elements || !elements.length) return
      var idx = elements[0].index
      emit('select-outcome', idx === 0 ? 'done' : 'failed')
    }
  }
})
</script>
