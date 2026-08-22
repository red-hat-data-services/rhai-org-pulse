<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'

const props = defineProps({
  chart: { type: String, required: true }
})

const container = ref(null)
const error = ref(null)

async function render() {
  if (!container.value || !props.chart) return
  error.value = null
  try {
    const mermaid = (await import('mermaid')).default
    const dark = document.documentElement.classList.contains('dark')
    mermaid.initialize({
      startOnLoad: false,
      theme: dark ? 'dark' : 'base',
      themeVariables: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px'
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

onMounted(() => nextTick(render))
watch(() => props.chart, () => nextTick(render))
</script>

<template>
  <div>
    <div v-if="error" class="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded p-2">
      Could not render diagram: {{ error }}
    </div>
    <div ref="container" class="overflow-x-auto mermaid-wrap" />
  </div>
</template>

<style scoped>
.mermaid-wrap :deep(svg) {
  max-width: 100%;
  height: auto;
}
</style>
