<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Site Configuration</h3>
      <div class="space-y-4">
        <div>
          <label for="titlePrefix" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title Prefix
          </label>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Shown as a subtitle in the sidebar and prepended to the page title (e.g. "AI Engineering").
          </p>
          <input
            id="titlePrefix"
            v-model="titlePrefix"
            type="text"
            maxlength="100"
            placeholder="e.g. AI Engineering"
            class="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label for="authEmailDomain" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Auth Email Domain
          </label>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
            If your OAuth proxy rewrites user emails to a different domain
            (e.g. cluster.local), set that domain here so role assignments
            match correctly. Can also be set via AUTH_EMAIL_DOMAIN env var
            (env var takes precedence).
          </p>
          <input
            id="authEmailDomain"
            v-model="authEmailDomain"
            type="text"
            maxlength="253"
            placeholder="e.g. cluster.local"
            class="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <button
          @click="save"
          :disabled="saving"
          class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getSiteConfig, saveSiteConfig } from '@shared/client/services/api'

const emit = defineEmits(['toast', 'config-updated'])

const titlePrefix = ref('')
const authEmailDomain = ref('')
const saving = ref(false)

onMounted(async () => {
  try {
    const config = await getSiteConfig()
    titlePrefix.value = config.titlePrefix || ''
    authEmailDomain.value = config.authEmailDomain || ''
  } catch {
    // ignore — defaults to empty
  }
})

async function save() {
  saving.value = true
  try {
    await saveSiteConfig({
      titlePrefix: titlePrefix.value,
      authEmailDomain: authEmailDomain.value
    })
    emit('config-updated', { titlePrefix: titlePrefix.value })
    emit('toast', { message: 'Site configuration saved', type: 'success' })
  } catch (err) {
    emit('toast', { message: err.message || 'Failed to save configuration', type: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
