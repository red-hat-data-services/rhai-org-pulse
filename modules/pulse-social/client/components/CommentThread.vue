<template>
  <div class="space-y-4">
    <!-- Comment list -->
    <div v-for="comment in comments" :key="comment.id" class="flex items-start gap-3">
      <PersonAvatar :name="comment.author_name" :uid="comment.author_uid" size="sm" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ comment.author_name }}</span>
          <time class="text-xs text-gray-400 dark:text-gray-500" :title="new Date(comment.created_at).toLocaleString()">
            {{ formatTime(comment.created_at) }}
          </time>
          <span v-if="comment.edited_at" class="text-xs text-gray-400 dark:text-gray-500">(edited)</span>
        </div>
        <div class="text-sm text-gray-700 dark:text-gray-300 mt-0.5 leading-relaxed">
          <MarkdownRenderer :content="comment.body" />
        </div>
        <div class="mt-1 flex items-center gap-2">
          <button
            v-if="canDelete(comment)"
            @click="$emit('delete', comment.id)"
            class="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <p v-if="comments.length === 0" class="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
      No comments yet. Be the first to share your thoughts.
    </p>

    <!-- Add comment input -->
    <div class="flex items-start gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
      <PersonAvatar :name="userName" :uid="userUid" size="sm" />
      <div class="flex-1 flex items-center gap-2">
        <input
          v-model="newComment"
          type="text"
          :placeholder="'Write a comment...'"
          class="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-primary-400 dark:focus:border-primary-500 transition-colors"
          @keydown.enter="handleSubmit"
        />
        <button
          @click="handleSubmit"
          :disabled="!newComment.trim()"
          class="px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer"
          :class="newComment.trim()
            ? 'bg-primary-600 text-white hover:bg-primary-700'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'"
        >
          Send
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import PersonAvatar from './PersonAvatar.vue'
import MarkdownRenderer from './MarkdownRenderer.vue'
import { useAuth } from '@shared/client/composables/useAuth'

const props = defineProps({
  comments: { type: Array, default: () => [] },
  currentUserUid: { type: String, default: '' },
  isAdmin: { type: Boolean, default: false }
})

const emit = defineEmits(['submit', 'delete'])

const { user } = useAuth()
const newComment = ref('')
const userName = ref('You')
const userUid = ref('')

onMounted(() => {
  if (user.value) {
    userName.value = user.value.name || user.value.email || 'You'
    userUid.value = user.value.uid || user.value.email || ''
  }
})

function canDelete(comment) {
  return comment.author_uid === (props.currentUserUid || userUid.value) || props.isAdmin
}

function formatTime(dateStr) {
  const now = Date.now()
  const created = new Date(dateStr).getTime()
  const diff = now - created
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString()
}

function handleSubmit() {
  const body = newComment.value.trim()
  if (!body) return
  emit('submit', body)
  newComment.value = ''
}
</script>
