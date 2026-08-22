<script setup>
import { Handle, Position } from '@vue-flow/core'

defineProps({
  data: { type: Object, required: true },
  id: { type: String, required: true },
})
</script>

<template>
  <Handle type="target" :position="Position.Left" class="!bg-gray-500" />

  <div
    class="px-3 py-2.5 min-w-[160px] max-w-[220px] cursor-pointer select-none rounded-lg border-2 shadow-sm"
    :style="{
      backgroundColor: data.colors.bg,
      borderColor: data.colors.border,
    }"
  >
    <div class="flex items-center gap-1.5 mb-1">
      <span
        class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide"
        :style="{ color: data.colors.text, backgroundColor: data.colors.border + '30' }"
      >{{ data.productLabel }}</span>
    </div>
    <div class="text-xs font-semibold text-gray-900 truncate" :title="id">
      {{ data.label }}
    </div>
    <div v-if="data.variant" class="text-[10px] text-gray-600 mt-0.5">
      {{ data.variant }}
    </div>
    <div class="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[10px] text-gray-500">
      <span v-if="data.runtime">{{ data.accel }}: {{ data.runtime }}</span>
      <span v-if="data.vllm">vLLM: {{ data.vllm }}</span>
      <span v-if="data.python">Py {{ data.python }}</span>
    </div>
  </div>

  <Handle type="source" :position="Position.Right" class="!bg-gray-500" />
</template>
