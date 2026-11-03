<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import { useRequestTeams } from '../../composables/useRequestTeams'
import { useChannels } from '../../composables/useChannels'
import { isoBusinessDaysFromNow, formatDateLabel } from '../../utils/request-dates'
import { describeSubmitError } from '../../utils/request-errors'
import RequestTeamFields from './RequestTeamFields.vue'
import RequestCommonFields from './RequestCommonFields.vue'
import TriageRequestSuccess from './TriageRequestSuccess.vue'
import ChannelMultiSelect from './ChannelMultiSelect.vue'

// Mirror server/triage-requests.js.
const LEAD_BUSINESS_DAYS = 20
const RPM_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._+-]*$/
const RPM_VERSION_RE = /^[a-zA-Z0-9._+~^-]+$/
const JIRA_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function defaults() {
  return {
    team: '',
    rpm_name: '',
    version: '',
    source_url: '',
    source_details: '',
    channels: [],
    jira_id: '',
    delivery_timeline: '',
    justification: '',
    release_target: '',
    release_commitment: ''
  }
}

const form = reactive(defaults())
const { teamProject, teams, loadingTeams, teamLoadError, loadTeams } = useRequestTeams(() => { form.team = '' })
const { channels, loading: loadingChannels, error: channelsError, load: loadChannels } = useChannels()

const minDeliveryDate = computed(() => isoBusinessDaysFromNow(LEAD_BUSINESS_DAYS))
const minDeliveryDateLabel = computed(() => formatDateLabel(minDeliveryDate.value))
const sortedChannels = computed(() => [...channels.value].sort((a, b) => a.name.localeCompare(b.name)))

const fieldErrors = ref({})
const submitting = ref(false)
const banner = ref('')
const success = ref(null)

onMounted(loadChannels)

function parseList(raw) {
  return String(raw || '').split(',').map(s => s.trim()).filter(Boolean)
}

function validate() {
  const errors = {}
  if (!form.team) errors.team = 'Team is required'
  else if (!teams.value.some(team => team.value === form.team)) errors.team = 'Select a team from the list'

  if (!RPM_NAME_RE.test(form.rpm_name.trim())) {
    errors.rpm_name = 'RPM name must start with a letter or digit and contain only letters, digits, dots, plus signs, underscores or dashes'
  }
  const version = form.version.trim()
  if (version && !RPM_VERSION_RE.test(version)) {
    errors.version = 'Version must contain only letters, digits and . _ + ~ ^ -'
  }

  const url = form.source_url.trim()
  if (url && !/^https?:\/\//i.test(url)) {
    errors.source_url = 'Source URL must be an HTTP or HTTPS URL'
  } else if (!url && !form.source_details.trim()) {
    errors.source_url = 'Provide a source URL or describe where the RPM comes from'
  }

  if (!form.channels.length) errors.channels = 'Select at least one channel'

  if (!JIRA_KEY_RE.test(form.jira_id.trim())) {
    errors.jira_id = 'Jira key must match the PROJECT-123 format (e.g. RHAISTRAT-1234)'
  }
  const date = form.delivery_timeline.trim()
  if (!DATE_RE.test(date)) {
    errors.delivery_timeline = 'Delivery date is required (YYYY-MM-DD)'
  } else if (date < minDeliveryDate.value) {
    errors.delivery_timeline = `Delivery date must be ${minDeliveryDateLabel.value} or later`
  }
  if (!form.justification.trim()) errors.justification = 'Business justification is required'
  return errors
}

function buildPayload() {
  return {
    team: form.team.trim(),
    project: teamProject.value,
    rpm_name: form.rpm_name.trim(),
    version: form.version.trim() || null,
    source_url: form.source_url.trim() || null,
    source_details: form.source_details.trim() || null,
    channels: [...form.channels],
    jira_id: form.jira_id.trim(),
    delivery_timeline: form.delivery_timeline.trim(),
    justification: form.justification.trim(),
    release_target: parseList(form.release_target),
    release_commitment: form.release_commitment.trim()
  }
}

async function submit() {
  const errors = validate()
  fieldErrors.value = errors
  banner.value = ''
  if (Object.keys(errors).length > 0) {
    banner.value = 'Please fix the highlighted fields before submitting.'
    return
  }
  submitting.value = true
  try {
    success.value = await apiRequest('/modules/product-builds/rpm-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload())
    })
  } catch (err) {
    const described = describeSubmitError(err, 'RPM request')
    if (described.fields) fieldErrors.value = { ...fieldErrors.value, ...described.fields }
    banner.value = described.banner
  } finally {
    submitting.value = false
  }
}

function resetForm() {
  teamProject.value = 'RHAISTRAT'
  Object.assign(form, defaults())
  fieldErrors.value = {}
  banner.value = ''
  success.value = null
}
</script>

<template>
  <div>
    <div class="mb-4">
      <h2 class="text-lg font-bold text-gray-900 dark:text-white">RPM Requests</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Request an RPM for one or more existing channels. A Jira Epic is filed and AIPCC triages it.
      </p>
    </div>

    <TriageRequestSuccess v-if="success" title="RPM request submitted" :result="success" @reset="resetForm" />

    <form v-else novalidate @submit.prevent="submit">
      <div
        v-if="banner"
        role="alert"
        class="mb-4 p-3 rounded-lg text-sm border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
      >
        {{ banner }}
      </div>

      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-6">
        <p class="text-xs text-gray-500 dark:text-gray-400 -mt-2">
          The request is filed under your signed-in identity.
        </p>

        <RequestTeamFields
          id-prefix="rpm"
          v-model:project="teamProject"
          v-model:team="form.team"
          :teams="teams"
          :loading="loadingTeams"
          :load-error="teamLoadError"
          :error="fieldErrors.team"
          :disabled="submitting"
          @retry="loadTeams"
        />

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="rpm-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              RPM name <span class="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="rpm-name"
              v-model="form.rpm_name"
              type="text"
              required
              autocomplete="off"
              placeholder="e.g. gcc-toolset-14"
              aria-required="true"
              :aria-invalid="!!fieldErrors.rpm_name"
              :aria-describedby="fieldErrors.rpm_name ? 'rpm-name-error' : null"
              class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              :class="fieldErrors.rpm_name ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
            />
            <p v-if="fieldErrors.rpm_name" id="rpm-name-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.rpm_name }}</p>
          </div>

          <div>
            <label for="rpm-version" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Version (optional)</label>
            <input
              id="rpm-version"
              v-model="form.version"
              type="text"
              autocomplete="off"
              placeholder="e.g. 14.2.1"
              :aria-invalid="!!fieldErrors.version"
              :aria-describedby="fieldErrors.version ? 'rpm-version-error' : null"
              class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              :class="fieldErrors.version ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
            />
            <p v-if="fieldErrors.version" id="rpm-version-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.version }}</p>
          </div>
        </div>

        <!-- Source -->
        <fieldset class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
          <legend class="px-2 text-sm font-medium text-gray-700 dark:text-gray-300">Source <span class="text-red-500" aria-hidden="true">*</span> <span class="text-xs font-normal text-gray-400">(URL or details)</span></legend>
          <div>
            <label for="rpm-source-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source URL</label>
            <input
              id="rpm-source-url"
              v-model="form.source_url"
              type="url"
              autocomplete="off"
              placeholder="e.g. https://src.fedoraproject.org/rpms/zlib"
              :aria-invalid="!!fieldErrors.source_url"
              :aria-describedby="fieldErrors.source_url ? 'rpm-source-url-error' : null"
              class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              :class="fieldErrors.source_url ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
            />
          </div>
          <div>
            <label for="rpm-source-details" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source details</label>
            <textarea
              id="rpm-source-details"
              v-model="form.source_details"
              rows="2"
              placeholder="e.g. Available in EPEL 10, or built from an upstream tarball"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            ></textarea>
          </div>
          <p v-if="fieldErrors.source_url" id="rpm-source-url-error" class="text-xs text-red-600 dark:text-red-400">{{ fieldErrors.source_url }}</p>
        </fieldset>

        <!-- Channels -->
        <div>
          <label for="rpm-channels" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Channels <span class="text-red-500" aria-hidden="true">*</span> <span class="text-xs font-normal text-gray-400">(where the RPM is needed)</span>
          </label>
          <p v-if="loadingChannels" class="text-sm text-gray-500 dark:text-gray-400">Loading channels...</p>
          <div v-else-if="channelsError" class="text-sm text-red-600 dark:text-red-400">
            Could not load channels.
            <button type="button" class="ml-1 underline" @click="loadChannels">Retry</button>
          </div>
          <p v-else-if="!sortedChannels.length" class="text-sm text-gray-500 dark:text-gray-400">No channels are available.</p>
          <ChannelMultiSelect
            v-else
            id="rpm-channels"
            v-model="form.channels"
            :options="sortedChannels"
            :invalid="!!fieldErrors.channels"
            :described-by="fieldErrors.channels ? 'rpm-channels-error' : null"
            :disabled="submitting"
          />
          <p v-if="fieldErrors.channels" id="rpm-channels-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors.channels }}</p>
        </div>

        <RequestCommonFields
          id-prefix="rpm"
          v-model:jira-id="form.jira_id"
          v-model:delivery-timeline="form.delivery_timeline"
          v-model:justification="form.justification"
          :errors="fieldErrors"
          :min-date="minDeliveryDate"
          :min-date-label="minDeliveryDateLabel"
          justification-placeholder="Why does your team need this RPM?"
        />

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="rpm-release-target" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Release targets (optional)</label>
            <input
              id="rpm-release-target"
              v-model="form.release_target"
              type="text"
              autocomplete="off"
              placeholder="Comma-separated product versions, e.g. 3.4,3.5"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label for="rpm-release-commitment" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Release commitment (optional)</label>
            <input
              id="rpm-release-commitment"
              v-model="form.release_commitment"
              type="text"
              autocomplete="off"
              placeholder="e.g. 3.4 GA"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        <div class="flex items-center gap-3 pt-2">
          <button
            type="submit"
            :disabled="submitting || loadingTeams || !!teamLoadError || !teams.length"
            class="px-5 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ submitting ? 'Submitting...' : 'Submit RPM request' }}
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
