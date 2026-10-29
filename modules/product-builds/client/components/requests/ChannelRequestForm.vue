<script setup>
import { ref, reactive, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import { useRequestTeams } from '../../composables/useRequestTeams'
import { isoBusinessDaysFromNow, formatDateLabel } from '../../utils/request-dates'
import { describeSubmitError } from '../../utils/request-errors'
import RequestTeamFields from './RequestTeamFields.vue'
import RequestCommonFields from './RequestCommonFields.vue'
import TriageRequestSuccess from './TriageRequestSuccess.vue'

// Mirror server/triage-requests.js.
const LEAD_BUSINESS_DAYS = 20
const FREE_TEXT_MAX_LENGTH = 200
const JIRA_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const STACK_FIELDS = [
  { key: 'torch_version', id: 'chan-torch-version', label: 'Torch version', placeholder: 'e.g. 2.12' },
  { key: 'accelerator', id: 'chan-accelerator', label: 'Accelerator', placeholder: 'e.g. ROCm 10.4, CUDA 13.2, Spyre' },
  { key: 'os', id: 'chan-os', label: 'Operating system', placeholder: 'e.g. RHEL 10' }
]

function defaults() {
  return {
    team: '',
    torch_version: '',
    accelerator: '',
    os: '',
    jira_id: '',
    delivery_timeline: '',
    justification: ''
  }
}

const form = reactive(defaults())
const { teamProject, teams, loadingTeams, teamLoadError, loadTeams } = useRequestTeams(() => { form.team = '' })

const minDeliveryDate = computed(() => isoBusinessDaysFromNow(LEAD_BUSINESS_DAYS))
const minDeliveryDateLabel = computed(() => formatDateLabel(minDeliveryDate.value))

const fieldErrors = ref({})
const submitting = ref(false)
const banner = ref('')
const success = ref(null)

function validate() {
  const errors = {}
  if (!form.team) errors.team = 'Team is required'
  else if (!teams.value.some(team => team.value === form.team)) errors.team = 'Select a team from the list'

  for (const field of STACK_FIELDS) {
    const value = form[field.key].trim()
    if (!value) errors[field.key] = `${field.label} is required`
    else if (value.length > FREE_TEXT_MAX_LENGTH) errors[field.key] = `${field.label} must be at most ${FREE_TEXT_MAX_LENGTH} characters`
  }

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
    success.value = await apiRequest('/modules/product-builds/channel-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team: form.team.trim(),
        project: teamProject.value,
        torch_version: form.torch_version.trim(),
        accelerator: form.accelerator.trim(),
        os: form.os.trim(),
        jira_id: form.jira_id.trim(),
        delivery_timeline: form.delivery_timeline.trim(),
        justification: form.justification.trim()
      })
    })
  } catch (err) {
    const described = describeSubmitError(err, 'channel request')
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
    <div
      id="chan-disclaimer"
      role="note"
      class="mb-4 p-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-300"
    >
      <p class="font-semibold">Talk to AIPCC before submitting</p>
      <p class="mt-1">
        New channels require an approved STRAT and prior discussion with AIPCC.
        Requests without both will not be considered.
      </p>
      <p class="mt-1">
        Questions? Ask in <strong>#forum-aipcc</strong> and tag <strong>@aipcc-productization</strong>.
      </p>
    </div>

    <div class="mb-4">
      <h2 class="text-lg font-bold text-gray-900 dark:text-white">Channel Requests</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Request a channel for a torch, accelerator and operating system combination AIPCC does not build yet.
        Check the existing channels first. A Jira Epic is filed and AIPCC triages it.
      </p>
    </div>

    <TriageRequestSuccess v-if="success" title="Channel request submitted" :result="success" @reset="resetForm" />

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
          id-prefix="chan"
          v-model:project="teamProject"
          v-model:team="form.team"
          :teams="teams"
          :loading="loadingTeams"
          :load-error="teamLoadError"
          :error="fieldErrors.team"
          :disabled="submitting"
          @retry="loadTeams"
        />

        <fieldset class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <legend class="px-2 text-sm font-medium text-gray-700 dark:text-gray-300">Channel stack <span class="text-red-500" aria-hidden="true">*</span></legend>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div v-for="field in STACK_FIELDS" :key="field.key">
              <label :for="field.id" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ field.label }} <span class="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                :id="field.id"
                v-model="form[field.key]"
                type="text"
                required
                autocomplete="off"
                :maxlength="FREE_TEXT_MAX_LENGTH"
                :placeholder="field.placeholder"
                aria-required="true"
                :aria-invalid="!!fieldErrors[field.key]"
                :aria-describedby="fieldErrors[field.key] ? `${field.id}-error` : null"
                class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                :class="fieldErrors[field.key] ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
              />
              <p v-if="fieldErrors[field.key]" :id="`${field.id}-error`" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ fieldErrors[field.key] }}</p>
            </div>
          </div>
        </fieldset>

        <RequestCommonFields
          id-prefix="chan"
          v-model:jira-id="form.jira_id"
          v-model:delivery-timeline="form.delivery_timeline"
          v-model:justification="form.justification"
          :errors="fieldErrors"
          :min-date="minDeliveryDate"
          :min-date-label="minDeliveryDateLabel"
          jira-hint="The approved STRAT for this channel."
          justification-placeholder="Which product, hardware or customer needs this channel, and why?"
        />

        <div class="flex items-center gap-3 pt-2">
          <button
            type="submit"
            :disabled="submitting || loadingTeams || !!teamLoadError || !teams.length"
            class="px-5 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ submitting ? 'Submitting...' : 'Submit channel request' }}
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
