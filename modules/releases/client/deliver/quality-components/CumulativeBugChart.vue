<template>
  <Line :data="chartData" :options="chartOptions" />
</template>

<script setup>
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const props = defineProps({
  labels: { type: Array, required: true },
  datasets: { type: Array, required: true }
});

const COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];

const chartData = computed(() => ({
  labels: props.labels.map(d => `Day ${d}`),
  datasets: props.datasets.map((ds, i) => ({
    label: ds.label,
    data: ds.data,
    borderColor: COLORS[i % COLORS.length],
    backgroundColor: (COLORS[i % COLORS.length]) + '20',
    borderWidth: 2,
    pointRadius: 2,
    tension: 0.3
  }))
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
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
    x: { title: { display: true, text: 'Days Since Release' } },
    y: { title: { display: true, text: 'Cumulative Bug Count' }, beginAtZero: true }
  }
};
</script>
