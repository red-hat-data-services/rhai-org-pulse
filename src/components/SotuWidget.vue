<script setup>
import { ref, computed, onErrorCaptured } from 'vue'
import { GripVertical, Maximize2, Minimize2, X } from 'lucide-vue-next'

const props = defineProps({
  widgetId: { type: String, required: true },
  name: { type: String, required: true },
  moduleName: { type: String, required: true },
  size: { type: String, default: 'half' },
  component: { type: [Object, Function], required: true }
})

const emit = defineEmits(['resize', 'remove'])

const widgetError = ref(null)
const retryKey = ref(0)

onErrorCaptured((err) => {
  widgetError.value = err
  return false
})

function handleRetry() {
  widgetError.value = null
  retryKey.value++
}

const sizeIcon = computed(() => props.size === 'full' ? Minimize2 : Maximize2)
const sizeTitle = computed(() => props.size === 'full' ? 'Shrink to half width' : 'Expand to full width')
</script>

<template>
  <div
    class="sotu-widget group/widget relative"
    :class="size === 'full' ? 'sotu-widget-full' : ''"
  >
    <!-- Controls overlay (visible on hover) -->
    <div class="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover/widget:opacity-100 transition-opacity">
      <span class="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 rounded">
        {{ moduleName }}
      </span>
      <button
        @click="emit('resize', widgetId, size === 'full' ? 'half' : 'full')"
        class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        :title="sizeTitle"
      >
        <component :is="sizeIcon" :size="14" />
      </button>
      <button
        @click="emit('remove', widgetId)"
        class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        title="Remove widget"
      >
        <X :size="14" />
      </button>
    </div>

    <!-- Drag handle (visible on hover) -->
    <div class="drag-handle absolute top-2 left-2 z-10 p-1 text-gray-300 dark:text-gray-600 opacity-0 group-hover/widget:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
      <GripVertical :size="16" />
    </div>

    <!-- Error state -->
    <div v-if="widgetError" class="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 p-5">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">{{ name }}</h3>
      <p class="text-sm text-red-600 dark:text-red-400 mb-3">This widget encountered an error.</p>
      <button
        @click="handleRetry"
        class="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
      >
        Click to retry
      </button>
    </div>

    <!-- Widget content -->
    <component
      v-else
      :is="component"
      :key="retryKey"
      :size="size"
    />
  </div>
</template>
