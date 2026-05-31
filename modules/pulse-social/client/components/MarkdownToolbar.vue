<template>
  <div class="flex items-center gap-0.5 flex-wrap">
    <button
      v-for="btn in buttons"
      :key="btn.label"
      @click="$emit('action', btn.action)"
      class="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      :title="btn.tooltip"
      :aria-label="btn.tooltip"
    >
      <span v-if="btn.text" class="text-xs font-bold">{{ btn.text }}</span>
      <svg v-else xmlns="http://www.w3.org/2000/svg" :width="btn.size || 16" :height="btn.size || 16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="btn.path"></svg>
    </button>

    <div class="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-1"></div>

    <button
      @click="$emit('action', 'image')"
      class="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      title="Upload image"
      aria-label="Upload image"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
    </button>

    <button
      @click="$emit('action', 'attach')"
      class="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
      title="Attach file"
      aria-label="Attach file"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
    </button>
  </div>
</template>

<script setup>
defineEmits(['action'])

const buttons = [
  { action: 'bold', text: 'B', tooltip: 'Bold (Ctrl+B)' },
  { action: 'italic', text: 'I', tooltip: 'Italic (Ctrl+I)' },
  { action: 'heading', tooltip: 'Heading', path: '<path d="M6 12h12"></path><path d="M6 4v16"></path><path d="M18 4v16"></path>' },
  { action: 'link', tooltip: 'Link (Ctrl+K)', path: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>' },
  { action: 'code', tooltip: 'Inline code', path: '<polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>' },
  { action: 'codeblock', tooltip: 'Code block', path: '<rect x="4" y="4" width="16" height="16" rx="2"></rect><line x1="8" y1="9" x2="16" y2="9"></line><line x1="8" y1="13" x2="12" y2="13"></line>' },
  { action: 'quote', tooltip: 'Quote', path: '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path>' },
  { action: 'ul', tooltip: 'Bulleted list', path: '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>' },
  { action: 'ol', tooltip: 'Numbered list', path: '<line x1="10" y1="6" x2="21" y2="6"></line><line x1="10" y1="12" x2="21" y2="12"></line><line x1="10" y1="18" x2="21" y2="18"></line><path d="M4 6h1v4"></path><path d="M4 10h2"></path><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>' },
]
</script>
