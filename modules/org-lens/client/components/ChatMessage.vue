<script setup>
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps({
  role: { type: String, required: true },
  content: { type: String, default: '' },
})

const isUser = computed(() => props.role === 'user')

const renderedContent = computed(() => {
  if (isUser.value) return props.content
  const raw = marked.parse(props.content || '', { breaks: true })
  return DOMPurify.sanitize(raw)
})
</script>

<template>
  <div
    class="flex w-full"
    :class="isUser ? 'justify-end' : 'justify-start'"
  >
    <div
      class="max-w-[80%] rounded-lg px-4 py-2 text-sm"
      :class="isUser
        ? 'bg-primary-600 text-white'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'"
    >
      <div v-if="isUser" class="whitespace-pre-wrap">{{ content }}</div>
      <div v-else class="prose prose-sm dark:prose-invert max-w-none" v-html="renderedContent" />
    </div>
  </div>
</template>
