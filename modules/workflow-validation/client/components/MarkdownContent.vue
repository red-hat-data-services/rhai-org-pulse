<template>
  <div
    class="text-sm leading-6 text-gray-600 dark:text-gray-300
      [&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h1:first-child]:mt-0
      [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2:first-child]:mt-0
      [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:font-semibold [&_h3:first-child]:mt-0
      [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0
      [&_ul]:my-2 [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:my-2 [&_ol]:ml-5 [&_ol]:list-decimal
      [&_li]:my-1 [&_strong]:font-semibold [&_strong]:text-gray-800 dark:[&_strong]:text-gray-100
      [&_a]:text-blue-600 [&_a]:underline dark:[&_a]:text-blue-400
      [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs dark:[&_code]:bg-gray-700
      [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-gray-100 [&_pre]:p-3 dark:[&_pre]:bg-gray-900
      [&_pre_code]:bg-transparent [&_pre_code]:p-0"
    v-html="rendered"
  />
</template>

<script setup>
import { computed } from 'vue'
import DOMPurify from 'dompurify'
import { Marked } from 'marked'

const props = defineProps({
  content: { type: String, default: '' }
})

const markdown = new Marked({ breaks: true, gfm: true })
const rendered = computed(() => DOMPurify.sanitize(markdown.parse(props.content || '')))
</script>
