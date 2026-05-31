<template>
  <div class="flex items-start gap-2 pt-3 border-t border-gray-100 dark:border-gray-700 mt-3">
    <PersonAvatar :name="userName" :uid="userUid" size="sm" />
    <div class="flex-1 flex items-center gap-2">
      <input
        ref="inputRef"
        v-model="text"
        type="text"
        placeholder="Write a comment..."
        class="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-primary-400 dark:focus:border-primary-500 transition-colors"
        @keydown.enter="submit"
      />
      <button
        @click="submit"
        :disabled="!text.trim()"
        class="p-1.5 rounded-lg transition-colors cursor-pointer"
        :class="text.trim()
          ? 'text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20'
          : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'"
        aria-label="Send comment"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import PersonAvatar from './PersonAvatar.vue'
import { useAuth } from '@shared/client/composables/useAuth'

const emit = defineEmits(['submit'])
const { user } = useAuth()

const text = ref('')
const inputRef = ref(null)
const userName = ref('You')
const userUid = ref('')

onMounted(() => {
  if (user.value) {
    userName.value = user.value.name || user.value.email || 'You'
    userUid.value = user.value.uid || user.value.email || ''
  }
  inputRef.value?.focus()
})

function submit() {
  const body = text.value.trim()
  if (!body) return
  emit('submit', body)
  text.value = ''
}
</script>
