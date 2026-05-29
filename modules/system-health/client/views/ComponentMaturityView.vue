<script setup>
const COMPONENT_MATURITY_URL = 'https://data-hub.pages.redhat.com/component-maturity/'
</script>

<template>
  <div class="flex flex-col -mx-6 -my-6 lg:-mx-8" style="min-height: calc(100vh - 4rem)">
    <div class="flex items-center justify-between gap-4 px-6 lg:px-8 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
      <div>
        <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Component maturity
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Maturity signals from the Data Hub component maturity dashboard.
        </p>
      </div>
      <a
        :href="COMPONENT_MATURITY_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="shrink-0 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
      >
        Open in new tab
      </a>
    </div>
    <iframe
      :src="COMPONENT_MATURITY_URL"
      title="Component maturity"
      class="w-full flex-1 border-0 bg-white block min-h-0"
      style="height: calc(100vh - 7.5rem)"
    />
  </div>
</template>
