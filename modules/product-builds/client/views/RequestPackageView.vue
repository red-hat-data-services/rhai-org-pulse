<script setup>
import { ref, reactive, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import { useAuth } from '@shared/client/composables/useAuth'

const { user } = useAuth()

const JIRA_BASE = 'https://redhat.atlassian.net/browse'
const PACKAGE_NAME_RE = /^[a-zA-Z][a-zA-Z0-9._-]*$/
const SAFE_IDENTIFIER_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/
const JIRA_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/
const VERSION_RE = /^[a-zA-Z0-9._-]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MIN_LEAD_TIME_DAYS = 8
const SOURCES = [
  { id: 'pypi', label: 'PyPI', hint: 'Published on pypi.org' },
  { id: 'git', label: 'Git repository', hint: 'HTTP(S) URL of the git repository' },
  { id: 'other', label: 'Other', hint: 'Manual source (internal index, archive, ...)' }
]

function isoDaysFromNow(days) {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const minDeliveryDate = computed(() => isoDaysFromNow(MIN_LEAD_TIME_DAYS))

function daysUntil(dateStr) {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(target.getTime())) return NaN
  return Math.round((target - today) / 86400000)
}

function defaults() {
  return {
    team: '',
    package_name: '',
    extras: '',
    package_source: 'pypi',
    source_url: '',
    version: '',
    backport_versions: '',
    other_hardware: '',
    hardware_ack: false,
    jira_id: '',
    justification: '',
    delivery_timeline: '',
    release_target: '',
    release_commitment: '',
    testing_requirements: '',
    testing_ack: false
  }
}

const form = reactive(defaults())
const fieldErrors = ref({})
const submitting = ref(false)
const banner = ref(null) // { type, text } form-level message
const warning = ref(null) // 200 production-presence warning payload
const duplicates = ref(null) // 409 existing_tickets array
const success = ref(null) // 201 (or demo 200) payload

const needsSourceUrl = computed(() => form.package_source === 'git' || form.package_source === 'other')
const identityLabel = computed(() => (user.value ? (user.value.displayName || user.value.email) : null))

function parseList(raw) {
  return String(raw || '').split(',').map(s => s.trim()).filter(Boolean)
}

function validate() {
  const errors = {}
  if (!form.team.trim()) errors.team = 'Team is required'

  if (!PACKAGE_NAME_RE.test(form.package_name.trim())) {
    errors.package_name = 'Package name must start with a letter and contain only letters, digits, dots, underscores or dashes'
  }

  const extras = parseList(form.extras)
  const seen = new Set()
  for (const extra of extras) {
    if (!SAFE_IDENTIFIER_RE.test(extra)) {
      errors.extras = 'Each extra must be a safe identifier (letters, digits, dot, underscore, dash; no spaces)'
      break
    }
    const key = extra.toLowerCase()
    if (seen.has(key)) {
      errors.extras = `Extras must not contain duplicates (${extra})`
      break
    }
    seen.add(key)
  }

  if (!SOURCES.some(s => s.id === form.package_source)) {
    errors.package_source = 'Package source is required'
  }
  if (needsSourceUrl.value) {
    const url = form.source_url.trim()
    if (!url) {
      errors.source_url = 'Source URL is required for git and other package sources'
    } else if (!/^https?:\/\//i.test(url)) {
      errors.source_url = 'Source URL must be an HTTP or HTTPS URL'
    }
  }

  const version = form.version.trim()
  if (version && !VERSION_RE.test(version)) {
    errors.version = 'Version must contain only letters, digits, dots, underscores or dashes'
  }

  if (!form.other_hardware.trim() && !form.hardware_ack) {
    errors.other_hardware = 'Provide hardware details or acknowledge the all-supported-accelerators default'
  }

  if (!JIRA_KEY_RE.test(form.jira_id.trim())) {
    errors.jira_id = 'Jira key must match the PROJECT-123 format (e.g. AIPCC-1234)'
  }

  if (!form.justification.trim()) errors.justification = 'Business justification is required'

  const date = form.delivery_timeline.trim()
  if (!DATE_RE.test(date)) {
    errors.delivery_timeline = 'Delivery date is required (YYYY-MM-DD)'
  } else if (daysUntil(date) < MIN_LEAD_TIME_DAYS) {
    errors.delivery_timeline = `Delivery date must be at least ${MIN_LEAD_TIME_DAYS} calendar days from today`
  }

  if (!form.testing_requirements.trim() && !form.testing_ack) {
    errors.testing_requirements = 'Provide testing requirements or acknowledge the default probe/import tests'
  }

  return errors
}

function buildPayload(skipProductionCheck) {
  const payload = {
    team: form.team.trim(),
    package_name: form.package_name.trim(),
    extras: parseList(form.extras),
    package_source: form.package_source,
    source_url: needsSourceUrl.value ? form.source_url.trim() : null,
    version: form.version.trim() || null,
    other_hardware: form.other_hardware.trim(),
    hardware_defaults_acknowledged: form.hardware_ack,
    jira_id: form.jira_id.trim(),
    justification: form.justification.trim(),
    delivery_timeline: form.delivery_timeline.trim(),
    release_target: parseList(form.release_target),
    release_commitment: form.release_commitment.trim(),
    testing_requirements: form.testing_requirements.trim(),
    testing_defaults_acknowledged: form.testing_ack,
    backport_versions: parseList(form.backport_versions)
  }
  if (skipProductionCheck) payload.skip_production_check = true
  return payload
}

async function submit(skipProductionCheck = false) {
  const errors = validate()
  fieldErrors.value = errors
  warning.value = null
  duplicates.value = null
  success.value = null
  banner.value = null
  if (Object.keys(errors).length > 0) {
    banner.value = { type: 'error', text: 'Please fix the highlighted fields before submitting.' }
    return
  }

  submitting.value = true
  try {
    const data = await apiRequest('/modules/product-builds/package-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(skipProductionCheck))
    })
    if (data && data.status === 'warning') {
      warning.value = data
      return
    }
    success.value = data
  } catch (err) {
    const data = (err && err.data) || {}
    if (err && err.status === 422 && data.fields) {
      fieldErrors.value = { ...fieldErrors.value, ...data.fields }
      banner.value = { type: 'error', text: data.error || 'Validation failed. Check the highlighted fields.' }
    } else if (err && err.status === 409 && Array.isArray(data.existing_tickets)) {
      duplicates.value = data.existing_tickets
      banner.value = { type: 'error', text: data.error || 'A recent package update request already exists for this package.' }
    } else if (err && err.status === 429) {
      const wait = data.retry_after_seconds
        ? ` Please try again in about ${data.retry_after_seconds} seconds.`
        : ''
      banner.value = { type: 'error', text: (err.message || 'Rate limited') + wait }
    } else if (err && (err.status === 502 || err.status === 503)) {
      banner.value = {
        type: 'error',
        text: (data.error || err.message || 'Upstream error') +
          ' Please check the Product Builds configuration or try again later.'
      }
    } else {
      const text = (err && err.message) ? err.message : 'Request failed'
      banner.value = {
        type: 'error',
        text: err && err.status
          ? text
          : `Could not reach the server (${text}). Check your connection and try again.`
      }
    }
  } finally {
    submitting.value = false
  }
}

function cancelWarning() {
  warning.value = null
}

function resetForm() {
  Object.assign(form, defaults())
  fieldErrors.value = {}
  banner.value = null
  warning.value = null
  duplicates.value = null
  success.value = null
}

function jiraHref(ticket) {
  return ticket && (ticket.url || (JIRA_BASE + '/' + ticket.key))
}
</script>

<template>
  <div class="max-w-[900px]">
    <!-- Header -->
    <div class="mb-6 flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Request Package</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Submit a package update request. A Jira Epic is filed and the onboarding pipeline is triggered on success.
        </p>
      </div>
      <div
        v-if="identityLabel"
        class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
      >
        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span>Submitting as <strong class="font-semibold">{{ identityLabel }}</strong></span>
      </div>
    </div>

    <!-- Success panel -->
    <div v-if="success" class="bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800/40 rounded-lg p-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 class="text-lg font-bold text-green-800 dark:text-green-300">Package request submitted</h2>
          <p class="text-sm text-green-600 dark:text-green-400/80">
            {{ success.summary || 'Request accepted' }}
            <span v-if="success.demo"> (demo mode)</span>
          </p>
        </div>
      </div>

      <dl class="space-y-3 text-sm">
        <div class="flex items-center gap-2">
          <dt class="text-gray-500 dark:text-gray-400 w-40 flex-shrink-0">Jira Epic</dt>
          <dd>
            <a
              v-if="success.jira && success.jira.url"
              :href="success.jira.url"
              target="_blank"
              rel="noopener noreferrer"
              class="font-semibold text-blue-600 hover:underline"
            >{{ success.jira.key }}</a>
            <span v-else class="font-semibold text-gray-900 dark:text-gray-200">{{ success.jira ? success.jira.key : 'N/A' }}</span>
          </dd>
        </div>
        <div v-if="success.requester" class="flex items-center gap-2">
          <dt class="text-gray-500 dark:text-gray-400 w-40 flex-shrink-0">Requester</dt>
          <dd class="text-gray-900 dark:text-gray-200">{{ success.requester }}</dd>
        </div>
        <div class="flex items-center gap-2">
          <dt class="text-gray-500 dark:text-gray-400 w-40 flex-shrink-0">Onboarding pipeline</dt>
          <dd v-if="success.pipeline && success.pipeline.triggered && success.pipeline.web_url">
            <a
              :href="success.pipeline.web_url"
              target="_blank"
              rel="noopener noreferrer"
              class="font-semibold text-blue-600 hover:underline"
            >View pipeline</a>
          </dd>
          <dd v-else-if="success.pipeline" class="text-gray-500 dark:text-gray-400">
            Not triggered<span v-if="success.pipeline.reason">: {{ success.pipeline.reason }}</span>
            <span v-else-if="success.pipeline.error">: {{ success.pipeline.error }}</span>
          </dd>
        </div>
      </dl>

      <button
        @click="resetForm"
        class="mt-5 px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
      >
        Submit another request
      </button>
    </div>

    <!-- Form -->
    <form v-else novalidate @submit.prevent="submit(false)">
      <!-- Form-level banner -->
      <div
        v-if="banner"
        role="alert"
        class="mb-4 p-3 rounded-lg text-sm border"
        :class="banner.type === 'error'
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
          : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'"
      >
        {{ banner.text }}
      </div>

      <!-- Duplicate tickets (409) -->
      <div
        v-if="duplicates"
        role="alert"
        class="mb-4 p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
      >
        <p class="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">
          Recent duplicate requests found. Review them before filing a new one.
        </p>
        <ul class="space-y-1.5">
          <li v-for="ticket in duplicates" :key="ticket.key" class="text-sm text-red-700 dark:text-red-400 flex items-center gap-2 flex-wrap">
            <a :href="jiraHref(ticket)" target="_blank" rel="noopener noreferrer" class="font-semibold hover:underline">{{ ticket.key }}</a>
            <span v-if="ticket.summary" class="text-red-600/80 dark:text-red-400/70 truncate max-w-[320px]">{{ ticket.summary }}</span>
            <span v-if="ticket.status" class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-red-100 dark:bg-red-900/40">{{ ticket.status }}</span>
            <span v-if="ticket.created" class="text-xs text-red-500/70 dark:text-red-400/50">created {{ ticket.created.slice(0, 10) }}</span>
          </li>
        </ul>
      </div>

      <!-- Production warning (200) -->
      <div
        v-if="warning"
        role="alert"
        class="mb-4 p-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
      >
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {{ warning.package_name }} is already present in production index(es)
            </p>
            <p class="text-sm text-amber-700 dark:text-amber-400/80 mt-1">{{ warning.message }}</p>
            <ul v-if="warning.found_in && warning.found_in.length" class="mt-2 space-y-1">
              <li v-for="entry in warning.found_in" :key="entry.product_version + entry.variant" class="text-xs text-amber-800 dark:text-amber-300/80">
                <span class="font-mono">{{ entry.product_version }} / {{ entry.variant }}</span>
                <a :href="entry.index_url" target="_blank" rel="noopener noreferrer" class="underline ml-1">{{ entry.index_url }}</a>
                <span v-if="entry.files && entry.files.length" class="block mt-0.5 text-amber-700/70 dark:text-amber-400/60">
                  {{ entry.files.slice(0, 3).join(', ') }}{{ entry.files.length > 3 ? ' …' : '' }}
                </span>
              </li>
            </ul>
            <div class="flex items-center gap-3 mt-3">
              <button
                type="button"
                @click="submit(true)"
                :disabled="submitting"
                class="px-4 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {{ submitting ? 'Submitting...' : 'Submit anyway' }}
              </button>
              <button
                type="button"
                @click="cancelWarning"
                class="px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-6">
        <!-- Requester -->
        <p class="text-xs text-gray-500 dark:text-gray-400 -mt-2">
          The request is filed under your signed-in identity. The server treats the authenticated identity as authoritative.
        </p>

        <!-- Team + package -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="req-team" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Team <span class="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="req-team"
              v-model="form.team"
              type="text"
              required
              autocomplete="off"
              placeholder="e.g. Platform"
              aria-required="true"
              :aria-invalid="!!fieldErrors.team"
              :aria-describedby="fieldErrors.team ? 'req-team-error' : null"
              class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              :class="fieldErrors.team ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
            />
            <p v-if="fieldErrors.team" id="req-team-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.team }}</p>
          </div>

          <div>
            <label for="req-package-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Package name <span class="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="req-package-name"
              v-model="form.package_name"
              type="text"
              required
              autocomplete="off"
              placeholder="e.g. vllm"
              aria-required="true"
              :aria-invalid="!!fieldErrors.package_name"
              :aria-describedby="fieldErrors.package_name ? 'req-package-name-error' : null"
              class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              :class="fieldErrors.package_name ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
            />
            <p v-if="fieldErrors.package_name" id="req-package-name-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.package_name }}</p>
          </div>

          <div class="md:col-span-2">
            <label for="req-extras" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Extras (optional)</label>
            <input
              id="req-extras"
              v-model="form.extras"
              type="text"
              autocomplete="off"
              placeholder="Comma-separated, e.g. cu12,dev"
              :aria-invalid="!!fieldErrors.extras"
              :aria-describedby="fieldErrors.extras ? 'req-extras-error' : null"
              class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              :class="fieldErrors.extras ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
            />
            <p v-if="fieldErrors.extras" id="req-extras-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.extras }}</p>
          </div>

          <div class="md:col-span-2">
            <fieldset>
              <legend class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Package source <span class="text-red-500" aria-hidden="true">*</span>
              </legend>
              <div class="flex flex-wrap gap-4" role="radiogroup" aria-required="true">
                <label
                  v-for="source in SOURCES"
                  :key="source.id"
                  class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  <input
                    v-model="form.package_source"
                    type="radio"
                    :value="source.id"
                    name="req-package-source"
                    class="text-primary-600 border-gray-300 dark:border-gray-600"
                  />
                  <span>{{ source.label }}<span class="text-gray-400 dark:text-gray-500 text-xs">({{ source.hint }})</span></span>
                </label>
              </div>
            </fieldset>
          </div>

          <div v-if="needsSourceUrl" class="md:col-span-2">
            <label for="req-source-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Source URL <span class="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="req-source-url"
              v-model="form.source_url"
              type="url"
              required
              autocomplete="off"
              placeholder="https://github.com/org/repo"
              aria-required="true"
              :aria-invalid="!!fieldErrors.source_url"
              :aria-describedby="fieldErrors.source_url ? 'req-source-url-error' : null"
              class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              :class="fieldErrors.source_url ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
            />
            <p v-if="fieldErrors.source_url" id="req-source-url-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.source_url }}</p>
          </div>

          <div>
            <label for="req-version" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Version (optional)</label>
            <input
              id="req-version"
              v-model="form.version"
              type="text"
              autocomplete="off"
              placeholder="e.g. 2.5.1"
              :aria-invalid="!!fieldErrors.version"
              :aria-describedby="fieldErrors.version ? 'req-version-error' : 'req-version-hint'"
              class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              :class="fieldErrors.version ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
            />
            <p v-if="fieldErrors.version" id="req-version-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.version }}</p>
            <div id="req-version-hint" class="mt-2 p-2.5 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
              <p class="text-xs text-amber-800 dark:text-amber-300">
                <strong>Prefer leaving this empty.</strong> Pinning a version restricts the onboarding pipeline to that
                exact release. Only set it when you specifically need that version.
              </p>
            </div>
          </div>

          <div>
            <label for="req-backport-versions" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Backport versions (optional)</label>
            <input
              id="req-backport-versions"
              v-model="form.backport_versions"
              type="text"
              autocomplete="off"
              placeholder="Comma-separated, e.g. 2.4.0,2.3.5"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        <!-- Hardware -->
        <fieldset class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <legend class="px-2 text-sm font-medium text-gray-700 dark:text-gray-300">Hardware support <span class="text-red-500" aria-hidden="true">*</span> <span class="text-xs font-normal text-gray-400">(details or acknowledgement)</span></legend>
          <label for="req-other-hardware" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Other hardware details (optional)
          </label>
          <textarea
            id="req-other-hardware"
            v-model="form.other_hardware"
            rows="2"
            placeholder="e.g. 2x H100 nodes, AMD MI300X"
            :disabled="form.hardware_ack"
            :aria-invalid="!!fieldErrors.other_hardware && !form.hardware_ack"
            :aria-describedby="fieldErrors.other_hardware ? 'req-other-hardware-error' : null"
            class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            :class="fieldErrors.other_hardware ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
          ></textarea>
          <label class="mt-2 inline-flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              id="req-hardware-ack"
              v-model="form.hardware_ack"
              type="checkbox"
              class="mt-0.5 text-primary-600 border-gray-300 dark:border-gray-600 rounded"
            />
            <span>I confirm the package must support all supported accelerators (default)</span>
          </label>
          <p v-if="fieldErrors.other_hardware" id="req-other-hardware-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.other_hardware }}</p>
        </fieldset>

        <!-- Jira + justification -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="req-jira-id" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Related Jira key <span class="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="req-jira-id"
              v-model="form.jira_id"
              type="text"
              required
              autocomplete="off"
              placeholder="e.g. AIPCC-1234"
              aria-required="true"
              :aria-invalid="!!fieldErrors.jira_id"
              :aria-describedby="fieldErrors.jira_id ? 'req-jira-id-error' : null"
              class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              :class="fieldErrors.jira_id ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
            />
            <p v-if="fieldErrors.jira_id" id="req-jira-id-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.jira_id }}</p>
          </div>

          <div>
            <label for="req-delivery-timeline" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Delivery date <span class="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="req-delivery-timeline"
              v-model="form.delivery_timeline"
              type="date"
              required
              :min="minDeliveryDate"
              aria-required="true"
              :aria-invalid="!!fieldErrors.delivery_timeline"
              :aria-describedby="fieldErrors.delivery_timeline ? 'req-delivery-timeline-error' : 'req-delivery-timeline-hint'"
              class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              :class="fieldErrors.delivery_timeline ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
            />
            <p id="req-delivery-timeline-hint" class="mt-1 text-xs text-gray-400 dark:text-gray-500">
              At least {{ MIN_LEAD_TIME_DAYS }} calendar days from today.
            </p>
            <p v-if="fieldErrors.delivery_timeline" id="req-delivery-timeline-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.delivery_timeline }}</p>
          </div>

          <div class="md:col-span-2">
            <label for="req-justification" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Business justification <span class="text-red-500" aria-hidden="true">*</span>
            </label>
            <textarea
              id="req-justification"
              v-model="form.justification"
              rows="3"
              required
              placeholder="Why does your team need this package?"
              aria-required="true"
              :aria-invalid="!!fieldErrors.justification"
              :aria-describedby="fieldErrors.justification ? 'req-justification-error' : null"
              class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              :class="fieldErrors.justification ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
            ></textarea>
            <p v-if="fieldErrors.justification" id="req-justification-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.justification }}</p>
          </div>

          <div>
            <label for="req-release-target" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Release targets (optional)</label>
            <input
              id="req-release-target"
              v-model="form.release_target"
              type="text"
              autocomplete="off"
              placeholder="Comma-separated product versions, e.g. 3.4,3.5"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label for="req-release-commitment" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Release commitment (optional)</label>
            <input
              id="req-release-commitment"
              v-model="form.release_commitment"
              type="text"
              autocomplete="off"
              placeholder="e.g. 3.4 GA"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        <!-- Testing -->
        <fieldset class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <legend class="px-2 text-sm font-medium text-gray-700 dark:text-gray-300">Testing requirements <span class="text-red-500" aria-hidden="true">*</span> <span class="text-xs font-normal text-gray-400">(details or acknowledgement)</span></legend>
          <label for="req-testing-requirements" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Testing beyond the defaults (optional)
          </label>
          <textarea
            id="req-testing-requirements"
            v-model="form.testing_requirements"
            rows="2"
            placeholder="e.g. Run the full wheel test suite on GPU CI"
            :disabled="form.testing_ack"
            :aria-invalid="!!fieldErrors.testing_requirements"
            :aria-describedby="fieldErrors.testing_requirements ? 'req-testing-requirements-error' : null"
            class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            :class="fieldErrors.testing_requirements ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
          ></textarea>
          <label class="mt-2 inline-flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              id="req-testing-ack"
              v-model="form.testing_ack"
              type="checkbox"
              class="mt-0.5 text-primary-600 border-gray-300 dark:border-gray-600 rounded"
            />
            <span>I accept the default probe/import tests (no additional testing requirements)</span>
          </label>
          <p v-if="fieldErrors.testing_requirements" id="req-testing-requirements-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.testing_requirements }}</p>
        </fieldset>

        <!-- Actions -->
        <div class="flex items-center gap-3 pt-2">
          <button
            type="submit"
            :disabled="submitting || !!warning"
            class="px-5 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ submitting ? 'Submitting...' : 'Submit request' }}
          </button>
          <button
            type="button"
            @click="resetForm"
            :disabled="submitting"
            class="px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </form>
  </div>
</template>
