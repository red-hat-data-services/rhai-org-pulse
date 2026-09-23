<script setup>
import { ref, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'
import { useAuth } from '@shared/client/composables/useAuth.js'

const config = ref({ url: '', httpProxy: '', httpsProxy: '', effective: {}, sources: {} })
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const saved = ref(false)
const { isAdmin } = useAuth()

async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await apiRequest('/modules/workflow-validation/config')
    config.value = {
      url: result.overrides.url || '',
      httpProxy: result.overrides.httpProxy || '',
      httpsProxy: result.overrides.httpsProxy || '',
      effective: result,
      sources: result.sources || {}
    }
  } catch (err) {
    error.value = err.message || 'Unable to load Workflow Validation settings.'
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  error.value = ''
  saved.value = false
  try {
    const result = await apiRequest('/modules/workflow-validation/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: config.value.url,
        httpProxy: config.value.httpProxy,
        httpsProxy: config.value.httpsProxy
      })
    })
    config.value = { ...config.value, effective: result, sources: result.sources || {} }
    saved.value = true
  } catch (err) {
    error.value = err.message || 'Unable to save Workflow Validation settings.'
  } finally {
    saving.value = false
  }
}

watch(isAdmin, function(admin) {
  if (admin) load()
}, { immediate: true })
</script>

<template>
  <section v-if="isAdmin" class="space-y-6 max-w-3xl">
    <div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Workflow Validation connection</h3>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        These settings apply only to backend requests from Workflow Validation to OpenSearch. OpenSearch credentials remain managed in Vault and are never shown or saved here.
      </p>
    </div>

    <p v-if="loading" class="text-sm text-gray-500">Loading configuration...</p>
    <template v-else>
      <div>
        <label for="workflow-validation-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">OpenSearch URL</label>
        <input id="workflow-validation-url" v-model="config.url" type="url" placeholder="https://opensearch.example.com" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm" />
        <p class="mt-1 text-xs text-gray-500">HTTP or HTTPS only; embedded usernames and passwords are not allowed. Clear a field to use its GitOps environment value or the local default. Effective value: {{ config.effective.url || 'local default' }}.</p>
      </div>

      <div class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
        <p class="text-sm font-medium text-amber-900 dark:text-amber-200">Proxy settings affect backend outbound traffic to Workflow Validation OpenSearch only.</p>
        <p class="mt-1 text-xs text-amber-800 dark:text-amber-300">Use credential-free HTTP or HTTPS proxy URLs. These values are intentionally not applied globally to other backend services.</p>
      </div>

      <div>
        <label for="workflow-validation-http-proxy" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">HTTP proxy</label>
        <input id="workflow-validation-http-proxy" v-model="config.httpProxy" type="url" placeholder="http://proxy.example.com:8080" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm" />
        <p class="mt-1 text-xs text-gray-500">Effective value: {{ config.effective.httpProxy || 'not configured' }}.</p>
      </div>
      <div>
        <label for="workflow-validation-https-proxy" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">HTTPS proxy</label>
        <input id="workflow-validation-https-proxy" v-model="config.httpsProxy" type="url" placeholder="http://proxy.example.com:8080" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm" />
        <p class="mt-1 text-xs text-gray-500">Effective value: {{ config.effective.httpsProxy || 'not configured' }}.</p>
      </div>

      <div class="flex items-center gap-3">
        <button @click="save" :disabled="saving" class="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg disabled:opacity-50">
          {{ saving ? 'Saving...' : 'Save connection settings' }}
        </button>
        <span v-if="saved" class="text-sm text-green-700 dark:text-green-300">Configuration saved.</span>
      </div>
      <p v-if="error" class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
    </template>
  </section>
</template>
