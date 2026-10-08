<template>
  <Bar :data="chartData" :options="chartOptions" :plugins="[statusGroupBoxesPlugin]" />
</template>

<script setup>
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const props = defineProps({
  labels: { type: Array, required: true },
  datasets: { type: Array, required: true }
});

const COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];
const STATUS_CATEGORY_PERCENTAGE = 0.8;

const statusGroupBoxesPlugin = {
  id: 'statusGroupBoxes',
  beforeDraw(chart) {
    const { chartArea, ctx, data, scales } = chart;
    const xScale = scales.x;
    const labels = data.labels || [];
    if (!xScale || labels.length === 0) return;

    const categoryStep = labels.length > 1
      ? Math.abs(xScale.getPixelForValue(1) - xScale.getPixelForValue(0))
      : chartArea.width;
    const boxWidth = Math.max(0, categoryStep * STATUS_CATEGORY_PERCENTAGE);
    const boxTop = chartArea.top - 4;
    const boxBottom = chartArea.bottom + 4;

    ctx.save();
    ctx.lineWidth = 1;

    labels.forEach((_, index) => {
      const center = xScale.getPixelForValue(index);
      const left = center - boxWidth / 2;

      ctx.fillStyle = index % 2 === 0 ? 'rgba(148, 163, 184, 0.06)' : 'rgba(148, 163, 184, 0.02)';
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
      ctx.fillRect(left, boxTop, boxWidth, boxBottom - boxTop);
      ctx.strokeRect(left, boxTop, boxWidth, boxBottom - boxTop);
    });

    ctx.restore();
  }
};

const chartData = computed(() => ({
  labels: props.labels,
  datasets: props.datasets.map((dataset, index) => ({
    label: dataset.label,
    data: dataset.data,
    backgroundColor: COLORS[index % COLORS.length],
    borderColor: COLORS[index % COLORS.length],
    borderWidth: 1
  }))
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { bottom: 16 } },
  datasets: {
    bar: {
      grouped: true,
      categoryPercentage: STATUS_CATEGORY_PERCENTAGE,
      barPercentage: 1
    }
  },
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: true, position: 'top' },
    tooltip: {
      callbacks: {
        label(context) {
          return `${context.dataset.label}: ${context.parsed.y} bugs`;
        }
      }
    }
  },
  scales: {
    x: {
      offset: true,
      title: { display: true, text: 'Jira Status', padding: { top: 10 } },
      ticks: {
        autoSkip: false,
        maxRotation: 0,
        minRotation: 0,
        padding: 6,
        callback(value) {
          const label = this.getLabelForValue(value);
          return label.length > 10 ? label.split(/\s+/) : label;
        }
      }
    },
    y: { title: { display: true, text: 'Bug Count' }, beginAtZero: true, ticks: { precision: 0 } }
  }
};
</script>
