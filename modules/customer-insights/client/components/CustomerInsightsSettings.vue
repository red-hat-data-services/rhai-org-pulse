<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-medium text-gray-900 mb-4">Customer Insights Settings</h3>
      <p class="text-sm text-gray-600 mb-6">
        Connect your Google account to store customer interaction data in Google Sheets.
      </p>
    </div>

    <!-- Google Account Connection -->
    <div class="border border-gray-200 rounded-lg p-6">
      <h4 class="text-sm font-medium text-gray-900 mb-4">Google Account</h4>

      <div v-if="loading" class="text-sm text-gray-500">
        Checking connection status...
      </div>

      <div v-else-if="isConnected" class="space-y-4">
        <div class="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
          <div class="flex items-center space-x-2">
            <svg class="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
            <span class="text-sm font-medium text-green-800">Google Drive Connected</span>
          </div>
          <button
            @click="disconnect"
            class="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Disconnect
          </button>
        </div>

        <!-- Spreadsheet Configuration -->
        <div class="space-y-3">
          <label class="block text-sm font-medium text-gray-700">
            Select Google Spreadsheet
          </label>

          <div v-if="spreadsheetConfig.spreadsheetId" class="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div class="flex-1">
              <p class="text-sm font-medium text-blue-900">{{ spreadsheetConfig.spreadsheetName || 'Unnamed Spreadsheet' }}</p>
              <p class="text-xs text-blue-700 font-mono">{{ spreadsheetConfig.spreadsheetId }}</p>
            </div>
            <button
              @click="selectSpreadsheet"
              class="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Change
            </button>
          </div>

          <button
            v-else
            @click="selectSpreadsheet"
            class="w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Select Spreadsheet
          </button>

          <p class="text-xs text-gray-500">
            Choose the Google Sheet where your customer interactions will be stored.
          </p>
        </div>
      </div>

      <div v-else>
        <button
          @click="connectGoogle"
          class="w-full px-4 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 font-medium flex items-center justify-center space-x-2"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span>Connect Google Account</span>
        </button>
        <p class="mt-2 text-xs text-gray-500">
          You'll be redirected to Google to authorize access to your Google Sheets and Drive.
        </p>
      </div>
    </div>

    <!-- Sheet Structure Help -->
    <div v-if="isConnected && spreadsheetConfig.spreadsheetId" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h5 class="text-sm font-medium text-blue-900 mb-2">📋 Required Sheet Structure</h5>
      <p class="text-sm text-blue-800 mb-2">
        Your spreadsheet must have a sheet named <strong>"Interactions"</strong> with these columns:
      </p>
      <div class="bg-white rounded border border-blue-200 p-3 overflow-x-auto">
        <code class="text-xs text-gray-700">
          ID | Date | Customer Company | Contact Name | Field Contact Name | Component | Geo | Industry Vertical | Environment | Customer Type | Status | Main AI Use Case | Tools of Choice | Pain Points | Feature Feedback | Future Wishlist | PM Comments
        </code>
      </div>
      <p class="text-xs text-blue-700 mt-2">
        The first row should contain these column headers. Data starts from row 2.
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const loading = ref(true)
const isConnected = ref(false)
const spreadsheetConfig = ref({
  spreadsheetId: null,
  spreadsheetName: null
})

async function checkConnectionStatus() {
  try {
    const response = await fetch('/api/modules/customer-insights/auth/google/status')
    const data = await response.json()
    isConnected.value = data.connected

    if (data.connected) {
      // Load spreadsheet config
      const configResponse = await fetch('/api/modules/customer-insights/spreadsheet/config')
      const configData = await configResponse.json()
      spreadsheetConfig.value = configData
    }
  } catch (error) {
    console.error('Failed to check Google connection:', error)
  } finally {
    loading.value = false
  }
}

function connectGoogle() {
  // Open OAuth flow in popup
  const width = 600
  const height = 700
  const left = window.screenX + (window.outerWidth - width) / 2
  const top = window.screenY + (window.outerHeight - height) / 2

  const popup = window.open(
    '/api/modules/customer-insights/auth/google',
    'GoogleAuth',
    `width=${width},height=${height},left=${left},top=${top}`
  )

  // Poll for popup close
  const pollTimer = setInterval(() => {
    if (popup.closed) {
      clearInterval(pollTimer)
      checkConnectionStatus()
    }
  }, 500)
}

async function disconnect() {
  try {
    await fetch('/api/modules/customer-insights/auth/google/disconnect', { method: 'POST' })
    isConnected.value = false
    spreadsheetConfig.value = { spreadsheetId: null, spreadsheetName: null }
    alert('Google account disconnected')
  } catch (error) {
    console.error('Failed to disconnect:', error)
    alert('Failed to disconnect Google account')
  }
}

function selectSpreadsheet() {
  // Use Google Picker API to select a spreadsheet
  loadGooglePicker()
}

function loadGooglePicker() {
  // Load Google Picker API
  const script = document.createElement('script')
  script.src = 'https://apis.google.com/js/api.js'
  script.onload = () => {
    window.gapi.load('picker', { callback: showPicker })
  }
  document.body.appendChild(script)
}

async function showPicker() {
  try {
    // Get access token and API key from our backend
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
      alert(`Spreadsheet "${spreadsheetName}" selected`)
    } catch (error) {
      console.error('Failed to save spreadsheet config:', error)
      alert('Failed to save spreadsheet selection')
    }
  }
}

onMounted(() => {
  checkConnectionStatus()
})
</script>
