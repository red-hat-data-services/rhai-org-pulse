<script setup>
import { computed, inject } from 'vue'
import { useAuth } from '@shared/client/composables/useAuth'
import RequestsLanding from '../components/requests/RequestsLanding.vue'
import PythonPackageRequestForm from '../components/requests/PythonPackageRequestForm.vue'
import RpmRequestForm from '../components/requests/RpmRequestForm.vue'
import ChannelRequestForm from '../components/requests/ChannelRequestForm.vue'

const nav = inject('moduleNav', null)
const { user } = useAuth()

const REQUEST_TYPES = [
  {
    id: 'python',
    tab: 'Python Packages',
    label: 'Python Package Requests',
    cta: 'Request a Python package',
    summary: 'A Python package (wheel) your team needs in the AIPCC indexes.',
    points: [
      'Python packages only, not RPMs',
      'Starts the onboarding pipeline automatically',
      'Delivered within 10 business days'
    ]
  },
  {
    id: 'rpm',
    tab: 'RPMs',
    label: 'RPM Requests',
    cta: 'Request an RPM',
    summary: 'A system package (RPM) that existing channels need.',
    points: [
      'Pick the channels that need the RPM',
      'Give a source URL or describe where it comes from',
      'Triaged by AIPCC'
    ]
  },
  {
    id: 'channel',
    tab: 'Channels',
    label: 'Channel Requests',
    cta: 'Request a channel',
    summary: 'A torch, accelerator and operating system combination AIPCC does not build yet.',
    points: [
      'Requires an approved STRAT',
      'Discuss with AIPCC before submitting',
      'Triaged by AIPCC'
    ]
  }
]
const FORMS = {
  python: PythonPackageRequestForm,
  rpm: RpmRequestForm,
  channel: ChannelRequestForm
}

const activeTab = computed(() => {
  const tab = nav && nav.params && nav.params.value ? nav.params.value.tab : null
  return typeof tab === 'string' && Object.hasOwn(FORMS, tab) ? tab : null
})
const identityLabel = computed(() => (user.value ? (user.value.displayName || user.value.email) : null))

function selectTab(tab) {
  if (nav) nav.updateParams({ tab: tab || undefined })
}
</script>

<template>
  <div class="max-w-[900px]">
    <div class="mb-6 flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">AIPCC-E Requests</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Request Python packages, RPMs and new channels from AIPCC.
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

    <div class="border-b border-gray-200 dark:border-gray-700 mb-6">
      <nav class="flex gap-4 overflow-x-auto" role="tablist" aria-label="Request types">
        <button
          type="button"
          role="tab"
          :aria-selected="activeTab === null"
          class="py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors"
          :class="activeTab === null
            ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
          @click="selectTab(null)"
        >Overview</button>
        <button
          v-for="type in REQUEST_TYPES"
          :key="type.id"
          type="button"
          role="tab"
          :data-testid="`request-tab-${type.id}`"
          :aria-selected="activeTab === type.id"
          class="py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors"
          :class="activeTab === type.id
            ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
          @click="selectTab(type.id)"
        >{{ type.tab }}</button>
      </nav>
    </div>

    <RequestsLanding v-if="!activeTab" :options="REQUEST_TYPES" @select="selectTab" />
    <KeepAlive v-else>
      <component :is="FORMS[activeTab]" :key="activeTab" />
    </KeepAlive>
  </div>
</template>
