import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const BASE = '/modules/product-builds'
// Mirrors the server-side validation in server/channels.js.
const CHANNEL_NAME_RE = /^[a-z0-9][a-z0-9.+-]{0,127}$/

export function useChannels() {
  const channels = ref([])
  const source = ref(null)
  const asOf = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const data = await apiRequest(`${BASE}/channels`)
      channels.value = Array.isArray(data?.channels) ? data.channels : []
      source.value = data?.source || null
      asOf.value = data?.as_of || null
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  return { channels, source, asOf, loading, error, load }
}

export function useChannelDetail() {
  const channel = ref(null)
  const loading = ref(false)
  const error = ref(null)
  let requestId = 0

  async function load(name) {
    const id = ++requestId
    channel.value = null
    loading.value = false
    error.value = null
    // "." and ".." survive encodeURIComponent and would be resolved as path
    // segments, hitting a different route, so reject names the API cannot serve.
    if (!CHANNEL_NAME_RE.test(name || '')) {
      error.value = 'Invalid channel name'
      return
    }
    loading.value = true
    try {
      const data = await apiRequest(`${BASE}/channels/${encodeURIComponent(name)}`)
      if (id !== requestId) return
      if (!data?.channel) throw new Error('Channel not found')
      channel.value = data.channel
    } catch (err) {
      if (id !== requestId) return
      error.value = err.message
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  function reset() {
    requestId++
    channel.value = null
    loading.value = false
    error.value = null
  }

  return { channel, loading, error, load, reset }
}
