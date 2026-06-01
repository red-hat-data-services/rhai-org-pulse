<template>
  <div class="prose-content" v-html="rendered"></div>
</template>

<script setup>
import { computed } from 'vue'
import { Marked } from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps({
  content: { type: String, default: '' }
})

const md = new Marked({ breaks: true, gfm: true })

const rendered = computed(() => {
  if (!props.content) return ''
  const raw = md.parse(props.content)
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'code', 'pre', 'h1', 'h2', 'h3', 'blockquote', 'hr'],
    ALLOWED_ATTR: ['href', 'target', 'rel']
  })
})
</script>

<style scoped>
.prose-content :deep(p) {
  margin-bottom: 0.5em;
}
.prose-content :deep(p:last-child) {
  margin-bottom: 0;
}
.prose-content :deep(a) {
  color: rgb(var(--color-primary-600, 37 99 235));
  text-decoration: underline;
}
.prose-content :deep(code) {
  background: rgb(243 244 246);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
}
:root.dark .prose-content :deep(code) {
  background: rgb(55 65 81);
}
.prose-content :deep(pre) {
  background: rgb(243 244 246);
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin: 0.5em 0;
}
:root.dark .prose-content :deep(pre) {
  background: rgb(31 41 55);
}
.prose-content :deep(pre code) {
  background: transparent;
  padding: 0;
}
.prose-content :deep(blockquote) {
  border-left: 3px solid rgb(209 213 219);
  padding-left: 1rem;
  margin: 0.5em 0;
  color: rgb(107 114 128);
}
:root.dark .prose-content :deep(blockquote) {
  border-left-color: rgb(75 85 99);
  color: rgb(156 163 175);
}
.prose-content :deep(ul),
.prose-content :deep(ol) {
  padding-left: 1.5rem;
  margin: 0.5em 0;
}
.prose-content :deep(h1),
.prose-content :deep(h2),
.prose-content :deep(h3) {
  font-weight: 600;
  margin: 0.75em 0 0.25em;
}
.prose-content :deep(h1) { font-size: 1.25em; }
.prose-content :deep(h2) { font-size: 1.125em; }
.prose-content :deep(h3) { font-size: 1em; }
</style>
