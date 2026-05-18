<script setup>
import { useDocumentation } from '../composables/useDocumentation.js'
import DocumentationContent from '../components/DocumentationContent.vue'

const { docData, loading, error, load } = useDocumentation()
</script>

<template>
  <div class="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
    <DocumentationContent
      :loading="loading"
      :error="error"
      :docData="docData"
      @retry="load"
    />
  </div>
</template>
