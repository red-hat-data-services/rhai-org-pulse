import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Composable for Google Drive OAuth and file picking
 */
export function useGoogleDrive() {
  const connected = ref(false)
  const connecting = ref(false)
  const error = ref(null)
  const pickerApiLoaded = ref(false)
  const oauthToken = ref(null)

  let popupWindow = null
  let messageListener = null

  // Check connection status on mount
  onMounted(async () => {
    await checkConnectionStatus()
    loadPickerApi()
  })

  // Cleanup on unmount
  onUnmounted(() => {
    if (messageListener) {
      window.removeEventListener('message', messageListener)
    }
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close()
    }
  })

  /**
   * Check if user has connected Google Drive
   */
  async function checkConnectionStatus() {
    try {
      const response = await fetch('/api/modules/customer-insights/auth/google/status')
      const data = await response.json()
      connected.value = data.connected
    } catch (err) {
      console.error('Error checking Google Drive status:', err)
    }
  }

  /**
   * Load Google Picker API script
   */
  function loadPickerApi() {
    if (window.google?.picker) {
      pickerApiLoaded.value = true
      return
    }

    const script = document.createElement('script')
    script.src = 'https://apis.google.com/js/api.js'
    script.onload = () => {
      window.gapi.load('picker', () => {
        pickerApiLoaded.value = true
      })
    }
    document.head.appendChild(script)
  }

  /**
   * Initiate Google OAuth flow in popup window
   */
  function connectGoogleDrive() {
    return new Promise((resolve, reject) => {
      connecting.value = true
      error.value = null

      // Open OAuth popup
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2

      popupWindow = window.open(
        '/api/modules/customer-insights/auth/google',
        'Google OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      )

      // Listen for messages from popup
      messageListener = (event) => {
        // Verify origin (adjust for production)
        if (event.origin !== window.location.origin) return

        if (event.data.type === 'google-oauth-success') {
          connected.value = true
          connecting.value = false
          window.removeEventListener('message', messageListener)
          messageListener = null
          resolve()
        } else if (event.data.type === 'google-oauth-error') {
          error.value = event.data.error
          connecting.value = false
          window.removeEventListener('message', messageListener)
          messageListener = null
          reject(new Error(event.data.error))
        }
      }

      window.addEventListener('message', messageListener)

      // Handle popup closed before completion
      const checkPopupClosed = setInterval(() => {
        if (popupWindow && popupWindow.closed) {
          clearInterval(checkPopupClosed)
          if (connecting.value) {
            connecting.value = false
            error.value = 'OAuth window was closed'
            window.removeEventListener('message', messageListener)
            messageListener = null
            reject(new Error('OAuth window was closed'))
          }
        }
      }, 500)
    })
  }

  /**
   * Disconnect Google Drive
   */
  async function disconnectGoogleDrive() {
    try {
      await fetch('/api/modules/customer-insights/auth/google/disconnect', {
        method: 'POST'
      })
      connected.value = false
      oauthToken.value = null
    } catch (err) {
      console.error('Error disconnecting Google Drive:', err)
      throw err
    }
  }

  /**
   * Open Google Picker to select files
   */
  function openFilePicker(_options = {}) {
    return new Promise((resolve, reject) => {
      if (!connected.value) {
        reject(new Error('Not connected to Google Drive. Please connect first.'))
        return
      }

      if (!pickerApiLoaded.value) {
        reject(new Error('Google Picker API not loaded'))
        return
      }

      const apiKey = import.meta.env.VITE_GOOGLE_PICKER_API_KEY
      if (!apiKey) {
        reject(new Error('Google Picker API key not configured'))
        return
      }

      // Note: For production, you'll need to get an OAuth token client-side
      // This is a simplified version - see docs for full implementation
      const picker = new window.google.picker.PickerBuilder()
        .addView(window.google.picker.ViewId.DOCS)
        .setOAuthToken(oauthToken.value)
        .setDeveloperKey(apiKey)
        .setCallback((data) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const file = data.docs[0]
            resolve({
              id: file.id,
              name: file.name,
              mimeType: file.mimeType,
              url: file.url
            })
          } else if (data.action === window.google.picker.Action.CANCEL) {
            reject(new Error('File picker was cancelled'))
          }
        })
        .build()

      picker.setVisible(true)
    })
  }

  /**
   * Download file content from Google Drive
   */
  async function downloadFile(fileId) {
    try {
      const response = await fetch(`/api/modules/customer-insights/drive/files/${fileId}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to download file')
      }

      return await response.json()
    } catch (err) {
      console.error('Error downloading file:', err)
      throw err
    }
  }

  return {
    connected,
    connecting,
    error,
    pickerApiLoaded,
    connectGoogleDrive,
    disconnectGoogleDrive,
    openFilePicker,
    downloadFile,
    checkConnectionStatus
  }
}
