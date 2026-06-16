<script setup>
import { ref, nextTick, onUnmounted } from 'vue'
import ChatMessage from '../components/ChatMessage.vue'
import ChatInput from '../components/ChatInput.vue'

const messages = ref([])
const isLoading = ref(false)
const messagesContainer = ref(null)

let abortController = null

function scrollToBottom() {
  nextTick(() => {
    const el = messagesContainer.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

async function handleSend(text) {
  messages.value.push({ role: 'user', content: text })
  scrollToBottom()

  isLoading.value = true
  messages.value.push({ role: 'assistant', content: '' })
  const assistantIdx = messages.value.length - 1

  abortController = new AbortController()

  try {
    const history = messages.value.slice(0, -1).map(m => ({
      role: m.role,
      content: m.content,
    }))

    const response = await fetch('/api/modules/org-lens/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: history.slice(0, -1),
      }),
      signal: abortController.signal,
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      messages.value[assistantIdx].content = 'Error: ' + (err.error || 'Request failed')
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      let eventType = null
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim()
        } else if (line.startsWith('data: ') && eventType) {
          const data = JSON.parse(line.slice(6))
          if (eventType === 'chunk' && data.text) {
            messages.value[assistantIdx].content += data.text
            scrollToBottom()
          } else if (eventType === 'error' && data.error) {
            messages.value[assistantIdx].content += '\n\n**Error:** ' + data.error
          }
          eventType = null
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      messages.value[assistantIdx].content = 'Error: ' + err.message
    }
  } finally {
    isLoading.value = false
    abortController = null
    scrollToBottom()
  }
}

onUnmounted(() => {
  if (abortController) abortController.abort()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto p-4 space-y-4"
    >
      <div v-if="messages.length === 0" class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
        Ask a question about people, teams, or expertise
      </div>
      <ChatMessage
        v-for="(msg, idx) in messages"
        :key="idx"
        :role="msg.role"
        :content="msg.content"
      />
      <div v-if="isLoading && messages[messages.length - 1]?.content === ''" class="flex justify-start">
        <div class="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2 text-sm text-gray-400">
          Thinking...
        </div>
      </div>
    </div>
    <ChatInput :disabled="isLoading" @send="handleSend" />
  </div>
</template>
