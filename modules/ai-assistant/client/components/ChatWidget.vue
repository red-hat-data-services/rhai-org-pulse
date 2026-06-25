<template>
  <!-- FAB button -->
  <button
    v-if="!isOpen"
    @click="isOpen = true"
    class="fixed bottom-6 right-6 z-60 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
    title="Open AI Assistant"
  >
    <BotMessageSquare :size="24" />
  </button>

  <!-- Chat drawer -->
  <Teleport to="body">
    <Transition name="chat-drawer">
      <div
        v-if="isOpen"
        class="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:h-[600px] sm:max-h-[80vh] z-60 flex flex-col bg-white dark:bg-gray-800 sm:rounded-2xl sm:shadow-2xl sm:border sm:border-gray-200 dark:sm:border-gray-700"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 sm:rounded-t-2xl">
          <div class="flex items-center gap-2">
            <BotMessageSquare :size="18" class="text-blue-600 dark:text-blue-400" />
            <span class="font-semibold text-sm text-gray-900 dark:text-gray-100">AI Assistant</span>
          </div>
          <button
            @click="isOpen = false"
            class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X :size="18" />
          </button>
        </div>

        <!-- Messages -->
        <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-4">
          <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full text-center px-4">
            <BotMessageSquare :size="40" class="text-gray-300 dark:text-gray-600 mb-3" />
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Ask me anything about your org data.</p>
            <div class="flex flex-wrap justify-center gap-2">
              <button
                v-for="chip in suggestions"
                :key="chip"
                @click="sendFromChip(chip)"
                class="px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-full border border-blue-200 dark:border-blue-800 transition-colors"
              >
                {{ chip }}
              </button>
            </div>
          </div>

          <ChatMessage
            v-for="(msg, i) in messages"
            :key="i"
            :role="msg.role"
            :content="msg.content"
            :streaming="msg.streaming"
          />
        </div>

        <!-- Input -->
        <div class="border-t border-gray-200 dark:border-gray-700 p-3">
          <form @submit.prevent="handleSubmit" class="flex items-end gap-2">
            <textarea
              ref="inputEl"
              v-model="inputText"
              @keydown.enter.exact.prevent="handleSubmit"
              @keydown.esc="isOpen = false"
              placeholder="Ask a question..."
              rows="1"
              :disabled="isStreaming"
              class="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 max-h-32 overflow-y-auto"
              @input="autoResize"
            />
            <button
              type="submit"
              :disabled="!inputText.trim() || isStreaming"
              class="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-xl transition-colors disabled:cursor-not-allowed"
            >
              <SendHorizonal :size="18" />
            </button>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { BotMessageSquare, X, SendHorizonal } from 'lucide-vue-next'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import ChatMessage from './ChatMessage.vue'

const STORAGE_KEY = 'ai-assistant-conversation'
const SESSION_KEY = 'ai-assistant-session-id'

const isOpen = ref(false)
const inputText = ref('')
const isStreaming = ref(false)
const messages = ref([])
const sessionId = ref(null)
const messagesContainer = ref(null)
const inputEl = ref(null)

const suggestions = [
  'Team velocity this sprint?',
  'Who has the most open issues?',
  'Show release readiness',
  'Summarize recent activity'
]

// Restore from sessionStorage
onMounted(() => {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (saved) messages.value = JSON.parse(saved)
    const savedSession = sessionStorage.getItem(SESSION_KEY)
    if (savedSession) sessionId.value = savedSession
  } catch { /* ignore corrupt data */ }
})

// Persist on change
watch(messages, (val) => {
  try {
    // Strip streaming flag before saving
    const clean = val.map(m => ({ role: m.role, content: m.content }))
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
  } catch { /* quota exceeded — ignore */ }
}, { deep: true })

// Scroll to bottom on new messages
watch(messages, () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}, { deep: true })

// Focus input when opened
watch(isOpen, (open) => {
  if (open) {
    nextTick(() => inputEl.value?.focus())
  }
})

// Esc key handler (global)
function onKeyDown(e) {
  if (e.key === 'Escape' && isOpen.value) {
    isOpen.value = false
  }
}
onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))

function getPageContext() {
  const hash = window.location.hash || '#/'
  const raw = hash.slice(2)
  const [pathPart] = raw.split('?')
  const parts = pathPart.split('/').filter(Boolean)
  const params = {}
  const queryPart = raw.split('?')[1]
  if (queryPart) {
    for (const pair of queryPart.split('&')) {
      const [k, v] = pair.split('=').map(decodeURIComponent)
      if (k) params[k] = v || ''
    }
  }
  return {
    module: parts[0] || 'home',
    view: parts[1] || null,
    params
  }
}

function autoResize(e) {
  const el = e.target
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 128) + 'px'
}

function sendFromChip(text) {
  inputText.value = text
  handleSubmit()
}

async function handleSubmit() {
  const text = inputText.value.trim()
  if (!text || isStreaming.value) return

  inputText.value = ''
  // Reset textarea height
  if (inputEl.value) inputEl.value.style.height = 'auto'

  messages.value.push({ role: 'user', content: text })
  messages.value.push({ role: 'assistant', content: '', streaming: true })
  const assistantIdx = messages.value.length - 1

  isStreaming.value = true
  const ctrl = new AbortController()

  try {
    await fetchEventSource('/api/modules/ai-assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        sessionId: sessionId.value,
        context: getPageContext()
      }),
      signal: ctrl.signal,
      openWhenHidden: true,

      onopen(response) {
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`)
        }
      },

      onmessage(ev) {
        if (ev.event === 'session') {
          const data = JSON.parse(ev.data)
          sessionId.value = data.sessionId
          sessionStorage.setItem(SESSION_KEY, data.sessionId)
        } else if (ev.event === 'delta') {
          const data = JSON.parse(ev.data)
          messages.value[assistantIdx].content += data.text
        } else if (ev.event === 'done') {
          messages.value[assistantIdx].streaming = false
        } else if (ev.event === 'error') {
          const data = JSON.parse(ev.data)
          messages.value[assistantIdx].content += `\n\n*Error: ${data.error}*`
          messages.value[assistantIdx].streaming = false
        }
      },

      onerror(err) {
        messages.value[assistantIdx].content += '\n\n*Connection lost. Please try again.*'
        messages.value[assistantIdx].streaming = false
        throw err // stop retrying
      }
    })
  } catch {
    // fetchEventSource throws on abort or onerror rethrow — already handled above
    if (messages.value[assistantIdx]?.streaming) {
      messages.value[assistantIdx].streaming = false
    }
  } finally {
    isStreaming.value = false
  }
}
</script>

<style scoped>
.chat-drawer-enter-active,
.chat-drawer-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.chat-drawer-enter-from,
.chat-drawer-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.97);
}

/* Mobile: slide up from bottom */
@media (max-width: 639px) {
  .chat-drawer-enter-from,
  .chat-drawer-leave-to {
    transform: translateY(100%);
  }
}
</style>
