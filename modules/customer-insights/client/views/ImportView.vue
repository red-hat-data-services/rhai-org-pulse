<template>
  <div class="p-6">
    <div class="mb-6">
      <div class="flex items-center gap-2 mb-1">
        <h1 class="text-2xl font-bold text-gray-900">Import Data</h1>
        <InfoTooltip text="Bulk import customer interactions from CSV files or Google Drive documents. Data is validated and appended to your configured Google Sheet. Supports drag-and-drop upload." />
      </div>
      <p class="text-gray-600 mt-1">Import customer interactions from various sources</p>
    </div>

    <!-- Status Message -->
    <div v-if="uploadSuccess" class="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <p class="text-green-800 font-medium text-lg mb-2">✅ {{ uploadSuccess }}</p>
          <p class="text-green-700 text-sm">Your data has been saved to Google Sheets and is ready to view.</p>
        </div>
        <div class="flex items-center space-x-3">
          <button
            @click="goToTable"
            class="px-4 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 font-medium flex items-center space-x-2 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>Table View</span>
          </button>
          <button
            @click="goToKanban"
            class="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium flex items-center space-x-2 shadow-sm transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Kanban Board</span>
          </button>
        </div>
      </div>
    </div>
    <div v-if="uploadError" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <p class="text-red-800">❌ Error: {{ uploadError }}</p>
    </div>

    <!-- Tab Navigation -->
    <div class="mb-6">
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-8">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              activeTab === tab.id
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
            ]"
          >
            {{ tab.label }}
          </button>
        </nav>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="bg-white rounded-lg shadow p-8">
      <!-- Spreadsheet Import -->
      <div v-if="activeTab === 'spreadsheet'" class="space-y-6">
        <div class="flex items-start space-x-4">
          <div class="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">CSV File Upload</h3>
            <p class="text-gray-600 mb-4">
              Upload a CSV file containing customer interaction data. The file should have headers matching the interaction fields.
            </p>
          </div>
        </div>

        <!-- File Upload Area -->
        <div
          @drop.prevent="handleDrop"
          @dragover.prevent="dragOver = true"
          @dragleave.prevent="dragOver = false"
          :class="[
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
            dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-gray-50'
          ]"
        >
          <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div class="mt-4">
            <label class="cursor-pointer">
              <span class="mt-2 block text-sm font-medium text-gray-900">
                Drop CSV file here or <span class="text-primary-600 hover:text-primary-500">browse</span>
              </span>
              <input
                type="file"
                accept=".csv"
                @change="handleFileSelect"
                class="hidden"
                ref="fileInput"
              />
            </label>
            <p class="mt-1 text-xs text-gray-500">CSV files only</p>
          </div>
        </div>

        <!-- File Preview -->
        <div v-if="selectedFile" class="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <svg class="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <p class="text-sm font-medium text-gray-900">{{ selectedFile.name }}</p>
                <p class="text-xs text-gray-500">{{ formatFileSize(selectedFile.size) }}</p>
              </div>
            </div>
            <button
              @click="clearFile"
              class="text-gray-400 hover:text-gray-600"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Upload Button -->
          <div class="mt-4 flex justify-end">
            <button
              @click="uploadFile"
              :disabled="uploading"
              class="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {{ uploading ? 'Uploading...' : 'Upload & Import' }}
            </button>
          </div>
        </div>

        <!-- Expected Format -->
        <div class="bg-gray-50 border border-gray-200 rounded p-4">
          <h4 class="text-sm font-medium text-gray-900 mb-2">Expected CSV Format:</h4>
          <p class="text-xs text-gray-600 mb-2">Your CSV should have headers with these column names (case-insensitive):</p>
          <code class="text-xs bg-white px-2 py-1 rounded block overflow-x-auto">
            customerCompany,contactName,fieldContactName,component,industryVertical,geo,customerType,environment,mainAIUseCase,toolsOfChoice,painPoints,featureFeedback,futureWishlist,pmComments,status
          </code>
        </div>
      </div>

      <!-- Transcript Import -->
      <div v-if="activeTab === 'transcript'" class="space-y-6">
        <div class="flex items-start space-x-4">
          <div class="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Transcript Import</h3>
            <p class="text-gray-600 mb-4">
              Paste meeting notes, call transcripts, or customer conversation summaries. Fill in the extracted details below.
            </p>
          </div>
        </div>

        <!-- Transcript Text Area -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="block text-sm font-medium text-gray-700">
              Paste Transcript or Meeting Notes
            </label>
            <button
              @click="autoExtract"
              :disabled="!transcriptText.trim() || extracting"
              class="px-4 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {{ extracting ? 'Extracting...' : '✨ Auto-Extract with AI' }}
            </button>
          </div>
          <textarea
            v-model="transcriptText"
            rows="10"
            placeholder="Paste your meeting notes, call transcript, or customer conversation here...

Example:
Meeting with John Smith from Acme Financial Corp (Banking, North America)
- Discussed fraud detection use case for real-time transaction monitoring
- Currently using PyTorch and Jupyter notebooks
- Main pain point: Kubernetes complexity is overwhelming their data science team
- Interested in automated deployment features
- Requested: better GPU scheduling, simplified workflows
- High priority account with 500+ data scientists"
            class="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
          ></textarea>
        </div>

        <!-- Quick Extract Helper -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 class="text-sm font-medium text-blue-900 mb-2">💡 Quick Extract Tip</h4>
          <p class="text-sm text-blue-800">
            The form below will help you manually extract key information from your transcript.
            Look for: customer/company names, industry, pain points, use cases, and feature requests.
          </p>
        </div>

        <!-- Extracted Data Form -->
        <div class="bg-white border border-gray-200 rounded-lg p-6">
          <h4 class="text-lg font-semibold text-gray-900 mb-4">Extract Customer Interaction Details</h4>

          <div class="space-y-4">
            <!-- Basic Info -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Customer Company *</label>
                <input
                  v-model="extractedData.customerCompany"
                  type="text"
                  placeholder="e.g., Acme Financial Corp"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Contact Name *</label>
                <input
                  v-model="extractedData.contactName"
                  type="text"
                  placeholder="e.g., John Smith"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Component *</label>
                <select
                  v-model="extractedData.component"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">-- Select --</option>
                  <option value="navigator">Project Navigator</option>
                  <option value="autox">AutoX</option>
                  <option value="platform">AI Platform</option>
                  <option value="d2ma">D2MA</option>
                  <option value="agentic">Agentic</option>
                  <option value="inferencing">Inferencing</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Industry Vertical</label>
                <input
                  v-model="extractedData.industryVertical"
                  type="text"
                  placeholder="e.g., Banking & Financial Services"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Geography</label>
                <select
                  v-model="extractedData.geo"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">-- Select --</option>
                  <option value="NA">North America</option>
                  <option value="EMEA">EMEA</option>
                  <option value="APAC">APAC</option>
                  <option value="LATAM">LATAM</option>
                </select>
              </div>
            </div>

            <!-- Use Case & Pain Points -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Main Use Case</label>
              <input
                v-model="extractedData.mainAIUseCase"
                type="text"
                placeholder="e.g., Fraud detection for real-time transaction monitoring"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Pain Points</label>
              <textarea
                v-model="extractedData.painPoints"
                rows="3"
                placeholder="What challenges or issues did the customer mention?"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              ></textarea>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Feature Feedback / Requests</label>
              <textarea
                v-model="extractedData.featureFeedback"
                rows="3"
                placeholder="What features or improvements did they request?"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              ></textarea>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                v-model="extractedData.status"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="Lead">Lead</option>
                <option value="Discovery">Discovery</option>
                <option value="Evaluating">Evaluating</option>
                <option value="Feedback Received">Feedback Received</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="mt-6 flex justify-end space-x-3">
            <button
              @click="clearTranscript"
              class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
            <button
              @click="submitTranscript"
              :disabled="!canSubmitTranscript || uploading"
              class="px-6 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {{ uploading ? 'Creating...' : 'Create Interaction' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Google Drive Import -->
      <div v-if="activeTab === 'google-drive'" class="space-y-4">
        <div class="flex items-start space-x-4">
          <div class="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <h3 class="text-lg font-semibold text-gray-900">Google Drive Import</h3>
            </div>
            <p class="text-gray-600 mb-4">
              Sign in with your Google account and pick files directly from Google Drive.
              Supports Google Sheets, CSV files, XLSX files, and Google Docs.
            </p>

            <!-- Connection Status -->
            <div v-if="!googleDrive.connected.value" class="mb-4">
              <button
                @click="connectGoogleDrive"
                :disabled="googleDrive.connecting.value"
                class="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg v-if="googleDrive.connecting.value" class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {{ googleDrive.connecting.value ? 'Connecting...' : 'Connect Google Drive' }}
              </button>
              <p v-if="googleDrive.error.value" class="text-sm text-red-600 mt-2">
                {{ googleDrive.error.value }}
              </p>
            </div>

            <div v-else class="mb-4 flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-4">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span class="text-green-800 font-medium">Connected to Google Drive</span>
              </div>
              <button
                @click="disconnectGoogleDrive"
                class="text-sm text-red-600 hover:text-red-800"
              >
                Disconnect
              </button>
            </div>

            <!-- File Picker (shown when connected) -->
            <div v-if="googleDrive.connected.value" class="bg-white border border-gray-200 rounded-lg p-6">
              <h4 class="text-sm font-medium text-gray-900 mb-4">Select File from Drive</h4>
              <button
                @click="pickGoogleDriveFile"
                :disabled="!googleDrive.pickerApiLoaded.value || processingDriveFile"
                class="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {{ processingDriveFile ? 'Processing...' : 'Pick File from Drive' }}
              </button>
              <p v-if="!googleDrive.pickerApiLoaded.value" class="text-xs text-gray-500 mt-2">
                Loading Google Picker...
              </p>
            </div>

            <div class="bg-gray-50 border border-gray-200 rounded p-4 mt-4">
              <h4 class="text-sm font-medium text-gray-900 mb-2">Supported file types:</h4>
              <ul class="list-disc list-inside text-sm text-gray-700 space-y-1">
                <li>Google Sheets → Exported as CSV</li>
                <li>CSV/XLSX files → Direct download</li>
                <li>Google Docs → Exported as plain text for transcript extraction</li>
              </ul>
              <p class="text-xs text-gray-500 mt-3">
                Files are processed the same way as local uploads
              </p>
            </div>

            <!-- Setup Instructions -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <h4 class="text-sm font-medium text-blue-900 mb-2">📝 Setup Required</h4>
              <p class="text-sm text-blue-800 mb-2">
                Google Drive import requires OAuth credentials. See setup guide:
              </p>
              <code class="text-xs bg-white text-blue-900 px-2 py-1 rounded block">
                docs/GOOGLE-CLOUD-SETUP-WALKTHROUGH.md
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import InfoTooltip from '../components/InfoTooltip.vue'
import { useGoogleDrive } from '../composables/useGoogleDrive'

const moduleNav = inject('moduleNav')

const activeTab = ref('spreadsheet')
const selectedFile = ref(null)
const dragOver = ref(false)
const uploading = ref(false)
const uploadSuccess = ref(null)
const uploadError = ref(null)
const fileInput = ref(null)
const transcriptText = ref('')
const extracting = ref(false)
const googleDrive = useGoogleDrive()
const processingDriveFile = ref(false)
const extractedData = ref({
  customerCompany: '',
  contactName: '',
  component: '',
  industryVertical: '',
  geo: '',
  mainAIUseCase: '',
  painPoints: '',
  featureFeedback: '',
  status: 'Discovery'
})

const tabs = [
  { id: 'spreadsheet', label: 'Spreadsheet Import' },
  { id: 'transcript', label: 'Transcript Import' },
  { id: 'google-drive', label: 'Google Drive Import (Coming Soon)' }
]

const canSubmitTranscript = computed(() => {
  return extractedData.value.customerCompany &&
         extractedData.value.contactName &&
         extractedData.value.component
})

function handleFileSelect(event) {
  const file = event.target.files[0]
  if (file && file.name.endsWith('.csv')) {
    selectedFile.value = file
    uploadError.value = null
  } else {
    uploadError.value = 'Please select a CSV file'
  }
}

function handleDrop(event) {
  dragOver.value = false
  const file = event.dataTransfer.files[0]
  if (file && file.name.endsWith('.csv')) {
    selectedFile.value = file
    uploadError.value = null
  } else {
    uploadError.value = 'Please drop a CSV file'
  }
}

function clearFile() {
  selectedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

async function uploadFile() {
  if (!selectedFile.value) return

  uploading.value = true
  uploadSuccess.value = null
  uploadError.value = null

  try {
    // Read the CSV file
    const text = await selectedFile.value.text()
    const lines = text.split('\n').filter(line => line.trim())

    if (lines.length < 2) {
      throw new Error('CSV file is empty or has no data rows')
    }

    // Parse CSV
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    const interactions = []

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      const interaction = {}

      headers.forEach((header, index) => {
        const key = header.toLowerCase()
          .replace(/\s+/g, '')
          .replace(/[^a-z0-9]/gi, '')

        let value = values[index]?.trim() || ''

        // Handle arrays (toolsOfChoice, futureWishlist)
        if (key === 'toolsofchoice' || key === 'futurewishlist') {
          value = value ? value.split(';').map(v => v.trim()).filter(v => v) : []
        }

        interaction[key] = value
      })

      interactions.push(interaction)
    }

    // Send to API
    const response = await fetch('/api/modules/customer-insights/interactions/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interactions,
        mode: 'create'
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Upload failed')
    }

    const result = await response.json()
    uploadSuccess.value = `Successfully imported ${result.created || interactions.length} interactions!`
    clearFile()
  } catch (error) {
    console.error('Upload error:', error)
    uploadError.value = error.message
  } finally {
    uploading.value = false
  }
}

function parseCSVLine(line) {
  const values = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim().replace(/^"|"$/g, ''))
      current = ''
    } else {
      current += char
    }
  }

  values.push(current.trim().replace(/^"|"$/g, ''))
  return values
}

function clearTranscript() {
  transcriptText.value = ''
  extractedData.value = {
    customerCompany: '',
    contactName: '',
    component: '',
    industryVertical: '',
    geo: '',
    mainAIUseCase: '',
    painPoints: '',
    featureFeedback: '',
    status: 'Discovery'
  }
  uploadError.value = null
  uploadSuccess.value = null
}

async function autoExtract() {
  if (!transcriptText.value.trim()) return

  extracting.value = true
  uploadError.value = null

  try {
    const response = await fetch('/api/modules/customer-insights/extract/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: transcriptText.value
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to extract data')
    }

    const extracted = await response.json()

    // Populate the form with extracted data
    extractedData.value = {
      customerCompany: extracted.customerCompany || '',
      contactName: extracted.contactName || '',
      component: extracted.component || '',
      industryVertical: extracted.industryVertical || '',
      geo: extracted.geo || '',
      mainAIUseCase: extracted.mainAIUseCase || '',
      painPoints: extracted.painPoints || '',
      featureFeedback: extracted.featureFeedback || '',
      status: extracted.status || 'Discovery'
    }

    // Show success notification if in demo mode
    if (extracted._demoMode) {
      uploadError.value = 'Demo mode: Please review and edit the extracted fields manually'
    }
  } catch (error) {
    console.error('Auto-extract error:', error)
    uploadError.value = error.message
  } finally {
    extracting.value = false
  }
}

async function submitTranscript() {
  if (!canSubmitTranscript.value) return

  uploading.value = true
  uploadSuccess.value = null
  uploadError.value = null

  try {
    const interaction = {
      ...extractedData.value,
      fieldContactName: 'Field Team',
      customerType: extractedData.value.customerType || 'Customer',
      environment: extractedData.value.environment || 'Unknown',
      toolsOfChoice: extractedData.value.toolsOfChoice || [],
      futureWishlist: extractedData.value.futureWishlist || [],
      pmComments: transcriptText.value ? `Transcript: ${transcriptText.value.substring(0, 500)}...` : ''
    }

    const response = await fetch('/api/modules/customer-insights/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(interaction)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create interaction')
    }

    uploadSuccess.value = 'Successfully created 1 interaction!'
    clearTranscript()
  } catch (error) {
    console.error('Transcript submission error:', error)
    uploadError.value = error.message
  } finally {
    uploading.value = false
  }
}

// Google Drive functions
async function connectGoogleDrive() {
  try {
    await googleDrive.connectGoogleDrive()
  } catch (error) {
    console.error('Failed to connect Google Drive:', error)
  }
}

async function disconnectGoogleDrive() {
  try {
    await googleDrive.disconnectGoogleDrive()
  } catch (error) {
    console.error('Failed to disconnect Google Drive:', error)
    uploadError.value = error.message
  }
}

async function pickGoogleDriveFile() {
  processingDriveFile.value = true
  uploadError.value = null
  uploadSuccess.value = null

  try {
    // Open Google Picker
    const file = await googleDrive.openFilePicker()

    // Download file content
    const fileData = await googleDrive.downloadFile(file.id)

    // Process based on file type
    if (fileData.mimeType.includes('spreadsheet') || fileData.mimeType.includes('csv')) {
      // Process as CSV
      await processCSVContent(fileData.content, fileData.name)
    } else if (fileData.mimeType.includes('document') || fileData.mimeType.includes('text')) {
      // Process as transcript
      transcriptText.value = fileData.content
      activeTab.value = 'transcript'
      uploadSuccess.value = `Loaded transcript from "${fileData.name}". Please review and extract details below.`
    } else {
      throw new Error(`Unsupported file type: ${fileData.mimeType}`)
    }
  } catch (error) {
    console.error('Error processing Google Drive file:', error)
    uploadError.value = error.message
  } finally {
    processingDriveFile.value = false
  }
}

async function processCSVContent(csvText, filename) {
  const lines = csvText.split('\n').filter(line => line.trim())

  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows')
  }

  // Parse CSV (reuse existing logic)
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const interactions = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const interaction = {}

    headers.forEach((header, index) => {
      const key = header.toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/gi, '')

      let value = values[index]?.trim() || ''

      // Handle arrays (toolsOfChoice, futureWishlist)
      if (key === 'toolsofchoice' || key === 'futurewishlist') {
        value = value ? value.split(';').map(v => v.trim()).filter(v => v) : []
      }

      interaction[key] = value
    })

    interactions.push(interaction)
  }

  // Send to API
  const response = await fetch('/api/modules/customer-insights/interactions/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      interactions,
      mode: 'create'
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Upload failed')
  }

  const result = await response.json()
  uploadSuccess.value = `Successfully imported ${result.created || interactions.length} interactions from "${filename}"!`
}

function goToKanban() {
  if (moduleNav) {
    moduleNav.navigateTo('kanban')
  }
}

function goToTable() {
  if (moduleNav) {
    moduleNav.navigateTo('table')
  }
}
</script>
