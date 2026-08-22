<script setup>
defineProps({
  message: { type: String, default: 'Copied to clipboard' },
  show: { type: Boolean, default: false }
})
</script>

<template>
  <Transition name="toast">
    <div
      v-if="show"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-lg bg-gray-900 text-white text-sm shadow-lg"
      role="status"
    >
      {{ message }}
    </div>
  </Transition>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
