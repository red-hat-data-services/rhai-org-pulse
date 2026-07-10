<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'

const props = defineProps({
  chart: { type: String, required: true },
  title: { type: String, default: '' }
})

const container = ref(null)
const error = ref(null)

async function render() {
  if (!container.value || !props.chart) return
  error.value = null
  try {
    const mermaid = (await import('mermaid')).default
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        primaryColor: '#e8f0fe',
        primaryBorderColor: '#1a73e8'
      },
      flowchart: { htmlLabels: true, curve: 'basis' }
    })
    const id = `mmd-${Math.random().toString(36).slice(2)}`
    const { svg } = await mermaid.render(id, props.chart)
    container.value.innerHTML = svg
  } catch (e) {
    error.value = e.message
  }
}

onMounted(() => {
  nextTick(render)
})

watch(() => props.chart, () => nextTick(render))
</script>

<template>
  <div>
    <h3 v-if="title" class="text-sm font-semibold text-gray-800 mb-3">{{ title }}</h3>
    <div v-if="error" class="text-sm text-red-600 bg-red-50 rounded p-3">{{ error }}</div>
    <div ref="container" class="overflow-x-auto mermaid-wrap" />
  </div>
</template>

<style scoped>
.mermaid-wrap :deep(svg) {
  max-width: 100%;
  height: auto;
}
</style>
