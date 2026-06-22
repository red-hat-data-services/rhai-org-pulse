<template>
  <div v-if="showModal" class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <!-- Background overlay -->
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" @click="handleSkip"></div>

      <!-- Modal panel -->
      <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
        <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 sm:mx-0 sm:h-10 sm:w-10">
              <svg class="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
              <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                Welcome to Customer Insights
              </h3>
              <div class="mt-4 space-y-4">
                <p class="text-sm text-gray-500">
                  Connect your Google account to store and manage customer interaction data in Google Sheets.
                </p>

                <!-- Setup Steps -->
                <div class="space-y-3">
                  <!-- Step 1: Connect Google -->
                  <div class="border border-gray-200 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                      <h4 class="text-sm font-medium text-gray-900">Step 1: Connect Google Drive</h4>
                      <span v-if="isConnected" class="text-xs text-green-600 font-medium">✓ Connected</span>
                    </div>

                    <div v-if="!isConnected">
                      <button
                        @click="connectGoogle"
                        class="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium flex items-center justify-center space-x-2"
                      >
                        <svg class="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <span>Connect Google</span>
                      </button>
                      <p class="mt-2 text-xs text-gray-500">
                        You'll be redirected to authorize Google Sheets and Drive access.
                      </p>
                    </div>
                    <div v-else class="flex items-center space-x-2 text-sm text-green-700">
                      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                      </svg>
                      <span>Google Drive connected</span>
                    </div>
                  </div>

                  <!-- Step 2: Select Spreadsheet -->
                  <div class="border border-gray-200 rounded-lg p-4" :class="{ 'opacity-50': !isConnected }">
                    <div class="flex items-center justify-between mb-2">
                      <h4 class="text-sm font-medium text-gray-900">Step 2: Select Spreadsheet</h4>
                      <span v-if="spreadsheetConfig.spreadsheetId" class="text-xs text-green-600 font-medium">✓ Selected</span>
                    </div>

                    <div v-if="spreadsheetConfig.spreadsheetId" class="space-y-2">
                      <div class="p-2 bg-blue-50 border border-blue-200 rounded">
                        <p class="text-sm font-medium text-blue-900">{{ spreadsheetConfig.spreadsheetName || 'Unnamed Spreadsheet' }}</p>
                        <p class="text-xs text-blue-700 font-mono">{{ spreadsheetConfig.spreadsheetId }}</p>
                      </div>
                      <button
                        @click="selectSpreadsheet"
                        class="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Change Spreadsheet
                      </button>
                    </div>
                    <div v-else>
                      <button
                        @click="selectSpreadsheet"
                        :disabled="!isConnected"
                        class="w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Select Spreadsheet
                      </button>
                      <p class="mt-2 text-xs text-gray-500">
                        Choose where your customer interactions will be stored.
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Sheet Structure Info -->
                <div v-if="isConnected" class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p class="text-xs font-medium text-blue-900 mb-1">📋 Required Sheet Structure</p>
                  <p class="text-xs text-blue-800 mb-2">
                    Your spreadsheet must have a sheet named <strong>"Interactions"</strong> with these columns:
                  </p>
                  <div class="bg-white rounded border border-blue-200 p-2 overflow-x-auto mb-2">
                    <code class="text-xs text-gray-700 whitespace-nowrap">
                      ID | Date | Customer Company | Contact Name | Field Contact Name | Component | Geo | Industry Vertical | Environment | Customer Type | Status | Main AI Use Case | Tools of Choice | Pain Points | Feature Feedback | Future Wishlist | PM Comments
                    </code>
                  </div>
                  <details class="text-xs">
                    <summary class="cursor-pointer text-blue-800 font-medium hover:text-blue-900">Component Values</summary>
                    <div class="mt-2 pl-4 space-y-1 text-blue-700">
                      <p><strong>Inference & Model Serving:</strong> vLLM, llm-d, Model Serving, Model Runtimes, LlamaStack</p>
                      <p><strong>RAG & Data:</strong> RAG + Vector DB, AutoRAG, Data Processing, Feature Store</p>
                      <p><strong>Training:</strong> Training, Training Hub, Fine Tuning, SDG (Synthetic Data Generation)</p>
                      <p><strong>Agents:</strong> Agentic, Agent Development, AgentOps</p>
                      <p><strong>Platform & Tooling:</strong> Project Navigator, Notebooks, AI Hub, AI Pipelines, MLflow</p>
                      <p><strong>Observability & Safety:</strong> Model Observability, Explainability, AI Safety, Model Evaluation</p>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
          <button
            v-if="isConnected && spreadsheetConfig.spreadsheetId"
            type="button"
            @click="handleComplete"
            class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
          >
            Get Started
          </button>
          <button
            type="button"
            @click="handleSkip"
            class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
          >
            {{ isConnected && spreadsheetConfig.spreadsheetId ? 'Close' : 'Skip for Now' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'complete'])

const showModal = ref(props.show)
const isConnected = ref(false)
const spreadsheetConfig = ref({
  spreadsheetId: null,
  spreadsheetName: null
})

watch(() => props.show, (newVal) => {
  showModal.value = newVal
  if (newVal) {
    checkConnectionStatus()
  }
})

// Listen for OAuth success message
onMounted(() => {
  window.addEventListener('message', handleOAuthMessage)
  checkConnectionStatus()
})

function handleOAuthMessage(event) {
  if (event.origin !== window.location.origin) return
  if (event.data.type === 'google-oauth-success') {
    checkConnectionStatus()
  }
}

async function checkConnectionStatus() {
  try {
    const response = await fetch('/api/modules/customer-insights/auth/google/status')
    const data = await response.json()
    isConnected.value = data.connected

    if (data.connected) {
      const configResponse = await fetch('/api/modules/customer-insights/spreadsheet/config')
      const configData = await configResponse.json()
      spreadsheetConfig.value = configData
    }
  } catch (error) {
    console.error('Failed to check Google connection:', error)
  }
}

function connectGoogle() {
  const width = 600
  const height = 700
  const left = window.screenX + (window.outerWidth - width) / 2
  const top = window.screenY + (window.outerHeight - height) / 2

  const popup = window.open(
    '/api/modules/customer-insights/auth/google',
    'GoogleAuth',
    `width=${width},height=${height},left=${left},top=${top}`
  )

  const pollTimer = setInterval(() => {
    if (popup.closed) {
      clearInterval(pollTimer)
      checkConnectionStatus()
    }
  }, 500)
}

function selectSpreadsheet() {
  if (!isConnected.value) return
  loadGooglePicker()
}

function loadGooglePicker() {
  const script = document.createElement('script')
  script.src = 'https://apis.google.com/js/api.js'
  script.onload = () => {
    window.gapi.load('picker', { callback: showPicker })
  }
  document.body.appendChild(script)
}

async function showPicker() {
  try {
    const tokenResponse = await fetch('/api/modules/customer-insights/auth/google/token')
    const { accessToken } = await tokenResponse.json()

    const configResponse = await fetch('/api/modules/customer-insights/auth/google/picker-config')
    const { apiKey } = await configResponse.json()

    const picker = new window.google.picker.PickerBuilder()
      .addView(window.google.picker.ViewId.SPREADSHEETS)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setCallback(pickerCallback)
      .build()

    picker.setVisible(true)
  } catch (error) {
    console.error('Failed to show picker:', error)
    alert('Failed to open spreadsheet picker')
  }
}

async function pickerCallback(data) {
  if (data.action === window.google.picker.Action.PICKED) {
    const doc = data.docs[0]
    const spreadsheetId = doc.id
    const spreadsheetName = doc.name

    try {
      await fetch('/api/modules/customer-insights/spreadsheet/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId, spreadsheetName })
      })

      spreadsheetConfig.value = { spreadsheetId, spreadsheetName }
    } catch (error) {
      console.error('Failed to save spreadsheet config:', error)
      alert('Failed to save spreadsheet selection')
    }
  }
}

function handleSkip() {
  showModal.value = false
  emit('close')
}

function handleComplete() {
  showModal.value = false
  emit('complete')
}
</script>
