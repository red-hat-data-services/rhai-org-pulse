import { ref, onMounted, onUnmounted } from 'vue'

/**
 * Composable for Jira OAuth 2.0 (3LO) per-user authentication
 *
 * @param {string} baseUrl - Base URL for Jira OAuth routes (e.g., '/api/modules/customer-insights')
 * @returns {object} Jira authentication state and methods
 */
export function useJiraAuth(baseUrl) {
  const connected = ref(false)
  const connecting = ref(false)
  const error = ref(null)
  const siteName = ref(null)
  const siteUrl = ref(null)

  let popupWindow = null
  let messageListener = null

  // Check connection status on mount
  onMounted(async () => {
    await checkConnectionStatus()
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
   * Check if user has connected Jira
   */
  async function checkConnectionStatus() {
    try {
      const response = await fetch(`${baseUrl}/auth/jira/status`)
      const data = await response.json()
      connected.value = data.connected
      siteName.value = data.siteName
      siteUrl.value = data.siteUrl
    } catch (err) {
      console.error('Error checking Jira status:', err)
    }
  }

  /**
   * Initiate Jira OAuth flow in popup window
   */
  function connectJira() {
    return new Promise((resolve, reject) => {
      connecting.value = true
      error.value = null

      // Open OAuth popup
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2

      popupWindow = window.open(
        `${baseUrl}/auth/jira`,
        'Jira OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      )

      // Listen for messages from popup
      messageListener = (event) => {
        // Verify origin
        if (event.origin !== window.location.origin) return

        if (event.data.type === 'jira-oauth-success') {
          connected.value = true
          siteName.value = event.data.siteName
          connecting.value = false
          window.removeEventListener('message', messageListener)
          messageListener = null
          resolve({ siteName: event.data.siteName })
        } else if (event.data.type === 'jira-oauth-error') {
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
   * Disconnect Jira
   */
  async function disconnectJira() {
    try {
      await fetch(`${baseUrl}/auth/jira/disconnect`, {
        method: 'POST'
      })
      connected.value = false
      siteName.value = null
      siteUrl.value = null
    } catch (err) {
      console.error('Error disconnecting Jira:', err)
      throw err
    }
  }

  return {
    connected,
    connecting,
    error,
    siteName,
    siteUrl,
    connectJira,
    disconnectJira,
    checkConnectionStatus
  }
}
