<template>
  <div class="max-w-3xl mx-auto space-y-6">
    <!-- Build Info -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">App Info</h3>
      <div class="grid grid-cols-2 gap-6">
        <dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <dt class="text-gray-500 dark:text-gray-400">Version</dt>
          <dd class="text-gray-900 dark:text-gray-100 font-mono">{{ buildInfo.version || 'unknown' }}</dd>
          <dt class="text-gray-500 dark:text-gray-400">Git SHA</dt>
          <dd class="text-gray-900 dark:text-gray-100 font-mono">{{ buildInfo.gitSha || 'dev' }}</dd>
          <dt class="text-gray-500 dark:text-gray-400">Build Date</dt>
          <dd class="text-gray-900 dark:text-gray-100">{{ buildInfo.buildDate || 'N/A' }}</dd>
          <dt class="text-gray-500 dark:text-gray-400">Node.js</dt>
          <dd class="text-gray-900 dark:text-gray-100 font-mono">{{ buildInfo.nodeVersion || 'unknown' }}</dd>
        </dl>
        <div class="flex items-center justify-center">
          <a
            href="https://github.com/accorvin/team-tracker"
            target="_blank"
            rel="noopener noreferrer"
            class="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <GithubIcon :size="32" />
            <span class="text-sm">Source Code</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Diagnostics Download -->
    <div
      v-if="isAdmin"
      class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
    >
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Download Diagnostics</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Collect a diagnostic bundle with system info, configuration, data health, and module diagnostics.
        Attach it to a GitHub issue to help with debugging.
      </p>

      <!-- Redaction level selector -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Redaction Level</label>
        <div class="flex gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              v-model="redactLevel"
              value="minimal"
              class="text-primary-600 focus:ring-primary-500"
            />
            <div>
              <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Minimal</span>
              <p class="text-xs text-gray-500 dark:text-gray-400">Redacts secrets/tokens. Keeps names and emails for internal debugging.</p>
            </div>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              v-model="redactLevel"
              value="aggressive"
              class="text-primary-600 focus:ring-primary-500"
            />
            <div>
              <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Aggressive</span>
              <p class="text-xs text-gray-500 dark:text-gray-400">Anonymizes all PII (names, emails, UIDs). Safe for public sharing.</p>
            </div>
          </label>
        </div>
      </div>

      <!-- PII Warning for aggressive mode -->
      <div
        v-if="redactLevel === 'aggressive'"
        class="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg"
      >
        <p class="text-sm text-amber-800 dark:text-amber-200">
          <strong>Note:</strong> Error messages and log entries may still contain partial personal information
          despite best-effort scrubbing. Review the downloaded file before sharing publicly.
        </p>
      </div>

      <!-- Action buttons -->
      <div class="flex gap-3">
        <button
          @click="downloadDiagnostics"
          :disabled="downloading"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <DownloadIcon :size="16" />
          {{ downloading ? 'Collecting...' : 'Download' }}
        </button>
        <button
          @click="copyDiagnostics"
          :disabled="copying"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CopyIcon :size="16" />
          {{ copyLabel }}
        </button>
      </div>

      <p v-if="error" class="mt-3 text-sm text-red-600 dark:text-red-400">{{ error }}</p>

      <!-- What's collected -->
      <div class="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
        <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">What's Collected</h4>
        <ul class="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc list-inside">
          <li>App version, build info, and Node.js version</li>
          <li>System info: platform, memory usage, uptime</li>
          <li>Environment variable presence (not values)</li>
          <li>Storage directory structure and file counts</li>
          <li>Module configuration and enabled state</li>
          <li>Data health checks: stale files, missing mappings, integrity issues</li>
          <li>Recent API request statistics (response times, error rates)</li>
          <li>Recent console errors and warnings</li>
          <li>Module-specific diagnostics (refresh state, sync status, cache stats)</li>
        </ul>
        <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
          No full data files are included. This is metadata only, focused on diagnosing problems.
        </p>
      </div>
    </div>

    <!-- Export Test Data -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Export Test Data</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Download a <code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">.tgz</code> archive of all production data with personal information (names, emails, usernames) replaced by fake values. Use it for local development and testing.
      </p>

      <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3 mb-4">
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">After downloading</p>
        <ol class="text-sm text-gray-700 dark:text-gray-300 space-y-2 list-decimal list-inside">
          <li>Extract the archive into your project root:
            <code class="block mt-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-800 dark:text-gray-200">tar xzf org-pulse-test-data.tgz -C .</code>
          </li>
          <li>This creates a <code class="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">data/</code> directory matching the production layout.</li>
          <li>Start the dev server — it will use the extracted data automatically:
            <code class="block mt-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-800 dark:text-gray-200">npm run dev:full</code>
          </li>
        </ol>
      </div>

      <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
        The archive is deterministic — the same source data always produces the same anonymized output. All names, emails, UIDs, and usernames are consistently mapped across files.
      </p>

      <button
        @click="downloadTestData"
        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
      >
        <DownloadIcon :size="16" />
        Download Test Data
      </button>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Download as DownloadIcon, Copy as CopyIcon, Github as GithubIcon } from 'lucide-vue-next'

defineProps({
  isAdmin: Boolean
})

const buildInfo = ref({})
const redactLevel = ref('minimal')
const downloading = ref(false)
const copying = ref(false)
const copyLabel = ref('Copy to Clipboard')
const error = ref(null)

onMounted(async function() {
  try {
    const res = await fetch('/api/must-gather?redact=minimal')
    if (res.ok) {
      const data = await res.json()
      buildInfo.value = data.buildInfo || {}
    }
  } catch {
    // Build info will show defaults
  }
})

async function downloadTestData() {
  const res = await fetch('/api/export/test-data')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'org-pulse-test-data.tgz'
  a.click()
  URL.revokeObjectURL(url)
}

async function fetchBundle() {
  const res = await fetch('/api/must-gather?redact=' + redactLevel.value)
  if (!res.ok) {
    const body = await res.json().catch(function() { return {} })
    throw new Error(body.error || 'Failed to collect diagnostics (HTTP ' + res.status + ')')
  }
  return res.json()
}

async function downloadDiagnostics() {
  downloading.value = true
  error.value = null
  try {
    const bundle = await fetchBundle()
    const json = JSON.stringify(bundle, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    a.download = 'must-gather-' + ts + '.json'
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    error.value = err.message
  } finally {
    downloading.value = false
  }
}

async function copyDiagnostics() {
  copying.value = true
  error.value = null
  try {
    const bundle = await fetchBundle()
    const json = JSON.stringify(bundle, null, 2)
    await navigator.clipboard.writeText(json)
    copyLabel.value = 'Copied!'
    setTimeout(function() { copyLabel.value = 'Copy to Clipboard' }, 2000)
  } catch (err) {
    error.value = err.message
  } finally {
    copying.value = false
  }
}
</script>
