<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      @click.self="$emit('cancel')"
    >
      <div class="fixed inset-0 bg-black/40" aria-hidden="true"></div>
      <div
        class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6"
        role="alertdialog"
        :aria-label="title"
      >
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">{{ title }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">{{ message }}</p>
        <div class="flex justify-end gap-3">
          <button
            @click="$emit('cancel')"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="$emit('confirm')"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: 'Are you sure?' },
  message: { type: String, default: 'This action cannot be undone.' },
  confirmLabel: { type: String, default: 'Delete' }
})

defineEmits(['confirm', 'cancel'])
</script>
