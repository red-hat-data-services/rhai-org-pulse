<template>
  <div class="p-6">
    <div class="text-center py-12 text-gray-500 dark:text-gray-400">
      <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
        <svg class="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Audit Log</p>
      <p class="text-sm max-w-md mx-auto">
        The unified audit log will show actions across planning, execution, and delivery
        domains. It will be available after audit integration in Phase 5.
      </p>
    </div>
  </div>
</template>

<script setup>
// Audit view placeholder.
// Will display cross-domain audit entries from releases/audit-log.json
// with filtering by domain, version, action, and date range.
</script>
