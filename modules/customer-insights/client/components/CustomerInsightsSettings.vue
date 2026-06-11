<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-medium text-gray-900 mb-4">Customer Insights Settings</h3>
      <p class="text-sm text-gray-600 mb-6">
        Configure Google Sheets integration and AI processing settings.
      </p>
    </div>

    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <p class="text-yellow-800 text-sm">
        🚧 <strong>Coming Soon:</strong> Settings for Google Sheets credentials and AI model configuration will be available in Phase 2.
      </p>
    </div>

    <div class="border-t border-gray-200 pt-6">
      <h4 class="text-sm font-medium text-gray-900 mb-3">Google Sheets Integration</h4>
      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
          <input
            type="text"
            disabled
            placeholder="Will be configured via secrets"
            class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Spreadsheet ID</label>
          <input
            type="text"
            disabled
            placeholder="Will be configured via secrets"
            class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// TODO: Implement settings in Phase 2
</script>
