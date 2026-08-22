<script setup>
import { ref, inject } from 'vue'
import { Search } from 'lucide-vue-next'

const nav = inject('moduleNav')
const query = ref('')

function submit() {
  const q = query.value.trim()
  if (!q) return
  nav.navigateTo('search', { q })
}
</script>

<template>
  <div class="relative w-full max-w-sm flex-shrink-0">
    <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
    <input
      v-model="query"
      type="text"
      placeholder="Search drops, artifacts, commits..."
      class="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      @keyup.enter="submit"
    />
  </div>
</template>
