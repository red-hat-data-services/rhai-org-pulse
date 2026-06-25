<template>
  <div class="flex gap-3" :class="isUser ? 'justify-end' : 'justify-start'">
    <div
      class="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
      :class="isUser
        ? 'bg-blue-600 text-white rounded-br-md'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-md'"
    >
      <div v-if="isUser" class="whitespace-pre-wrap">{{ content }}</div>
      <div
        v-else
        class="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_pre]:my-2 [&_code]:text-xs [&_pre]:text-xs"
        v-html="renderedHtml"
      />
      <div v-if="streaming" class="mt-1">
        <span class="inline-block w-1.5 h-4 bg-current opacity-60 animate-pulse" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Marked } from 'marked'
import DOMPurify from 'dompurify'

const md = new Marked({ breaks: true, gfm: true })

const props = defineProps({
  content: { type: String, default: '' },
  role: { type: String, required: true },
  streaming: { type: Boolean, default: false }
})

const isUser = computed(() => props.role === 'user')

const renderedHtml = computed(() => {
  if (!props.content) return ''
  return DOMPurify.sanitize(md.parse(props.content))
})
</script>
