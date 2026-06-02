<template>
  <div class="max-w-[680px] mx-auto py-6 px-4">
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
    <!-- Back button -->
    <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50">
      <button
        @click="goBack"
        class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        Post
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-primary-600"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="mx-4 my-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
      {{ error }}
    </div>

    <!-- Post + Comments thread -->
    <template v-else-if="post">
      <!-- Post content -->
      <div class="px-4 py-4 border-b border-gray-100 dark:border-gray-700/50">
        <div class="flex gap-3">
          <PersonAvatar :name="post.author_name" :uid="post.author_uid" size="md" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-[15px] text-gray-900 dark:text-gray-100">{{ post.author_name }}</span>
              <span v-if="post.author_team" class="text-sm text-gray-500 dark:text-gray-400">{{ post.author_team }}</span>
              <LabelBadge v-if="post.label" :label="post.label" :resolved="!!post.resolved" />
            </div>
            <time class="text-xs text-gray-400 dark:text-gray-500">{{ fullDate }}</time>
          </div>
          <!-- Overflow menu -->
          <div class="relative" v-if="canDelete">
            <button
              @click="menuOpen = !menuOpen"
              class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors cursor-pointer"
              aria-label="Post menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
            </button>
            <div
              v-if="menuOpen"
              class="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 w-40 z-20"
            >
              <button
                @click="showDeleteConfirm = true; menuOpen = false"
                class="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
              >
                {{ isOwnPost ? 'Delete my post' : 'Remove (admin)' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div class="mt-3 text-[16px] text-gray-800 dark:text-gray-200 leading-relaxed">
          <MarkdownRenderer :content="post.body" />
        </div>

        <!-- Attachments -->
        <AttachmentPreview v-if="post.attachments?.length" :attachments="post.attachments" />

        <!-- Reactions -->
        <ReactionBar
          :reactions="reactionCounts"
          :comment-count="post.comments?.length || 0"
          :post-id="post.id"
          @toggle="handleReaction"
          @view-comments="() => {}"
        />
      </div>

      <!-- Comments thread -->
      <div class="divide-y divide-gray-50 dark:divide-gray-800/50">
        <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50">
          <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {{ post.comments?.length || 0 }} {{ (post.comments?.length || 0) === 1 ? 'Reply' : 'Replies' }}
          </span>
        </div>

        <!-- Comments list -->
        <div v-for="comment in post.comments || []" :key="comment.id" class="px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
          <div class="flex gap-3">
            <PersonAvatar :name="comment.author_name" :uid="comment.author_uid" size="sm" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ comment.author_name }}</span>
                <time class="text-xs text-gray-400">{{ formatTime(comment.created_at) }}</time>
                <span v-if="comment.edited_at" class="text-xs text-gray-400">(edited)</span>
              </div>
              <div class="text-[15px] text-gray-700 dark:text-gray-300 mt-0.5 leading-snug">
                <MarkdownRenderer :content="comment.body" />
              </div>
              <button
                v-if="canDeleteComment(comment)"
                @click="handleDeleteComment(comment.id)"
                class="text-xs text-gray-400 hover:text-red-500 transition-colors cursor-pointer mt-1 opacity-0 group-hover:opacity-100"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        <!-- Empty comments -->
        <div v-if="!post.comments?.length" class="px-4 py-8 text-center">
          <p class="text-sm text-gray-400 dark:text-gray-500">No replies yet. Start the conversation.</p>
        </div>
      </div>

      <!-- Sticky reply input -->
      <div class="border-t border-gray-100 dark:border-gray-700/50 px-4 py-3">
        <div class="flex items-center gap-3">
          <PersonAvatar :name="userName" :uid="userUid" size="sm" />
          <div class="flex-1 relative">
            <input
              v-model="newComment"
              type="text"
              placeholder="Post your reply..."
              class="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none focus:border-primary-300 dark:focus:border-primary-600 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/30 transition-all"
              @keydown.enter="handleAddComment"
            />
          </div>
          <button
            @click="handleAddComment"
            :disabled="!newComment.trim()"
            class="px-4 py-2 text-sm font-semibold rounded-full transition-all cursor-pointer"
            :class="newComment.trim()
              ? 'bg-primary-600 text-white hover:bg-primary-700 active:scale-95'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'"
          >
            Reply
          </button>
        </div>
      </div>
    </template>

    <!-- Not found -->
    <div v-else class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">Post not found.</p>
    </div>
    </div>

    <!-- Delete confirmation -->
    <ConfirmDialog
      :visible="showDeleteConfirm"
      title="Delete this post?"
      message="This will permanently delete the post and all its comments. This can't be undone."
      confirm-label="Delete"
      @confirm="handleDelete"
      @cancel="showDeleteConfirm = false"
    />

    <!-- Comment delete confirmation -->
    <ConfirmDialog
      :visible="!!deletingCommentId"
      title="Delete this comment?"
      message="This can't be undone."
      confirm-label="Delete"
      @confirm="confirmDeleteComment"
      @cancel="deletingCommentId = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, inject } from 'vue'
import PersonAvatar from '../components/PersonAvatar.vue'
import LabelBadge from '../components/LabelBadge.vue'
import MarkdownRenderer from '../components/MarkdownRenderer.vue'
import AttachmentPreview from '../components/AttachmentPreview.vue'
import ReactionBar from '../components/ReactionBar.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useReactions } from '../composables/useReactions'
import { useAuth } from '@shared/client/composables/useAuth'
import { apiRequest } from '@shared/client/services/api'

const API_BASE = '/modules/pulse-social'

const nav = inject('moduleNav')
const { toggleReaction } = useReactions()
const { user, isAdmin: authIsAdmin } = useAuth()

const post = ref(null)
const loading = ref(true)
const error = ref(null)
const showDeleteConfirm = ref(false)
const deletingCommentId = ref(null)
const menuOpen = ref(false)
const newComment = ref('')

const userName = ref('You')
const userUid = ref('')

const currentUserUid = computed(() => user.value?.uid || user.value?.email || '')
const isAdmin = computed(() => authIsAdmin.value)
const isOwnPost = computed(() => post.value?.author_uid === currentUserUid.value)
const canDelete = computed(() => {
  if (!post.value) return false
  return isOwnPost.value || isAdmin.value
})

const fullDate = computed(() => {
  if (!post.value) return ''
  return new Date(post.value.created_at).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  })
})

const reactionCounts = computed(() => {
  if (!post.value?.reactions) return {}
  const counts = {}
  for (const [emoji, users] of Object.entries(post.value.reactions)) {
    counts[emoji] = Array.isArray(users) ? users.length : users
  }
  return counts
})

onMounted(async () => {
  if (user.value) {
    userName.value = user.value.name || user.value.email || 'You'
    userUid.value = user.value.uid || user.value.email || ''
  }

  document.addEventListener('click', handleMenuClickOutside)

  const postId = nav.params.value?.id
  if (!postId) {
    error.value = 'No post ID provided'
    loading.value = false
    return
  }

  try {
    post.value = await apiRequest(`${API_BASE}/posts/${postId}`)
  } catch (err) {
    error.value = err.status === 404 ? 'Post not found' : err.message
  } finally {
    loading.value = false
  }
})

function goBack() { nav.goBack() }

function handleMenuClickOutside(e) {
  if (menuOpen.value && !e.target.closest('[aria-label="Post menu"]')) {
    menuOpen.value = false
  }
}

onBeforeUnmount(() => {
  document.removeEventListener('click', handleMenuClickOutside)
})

function formatTime(dateStr) {
  const now = Date.now()
  const created = new Date(dateStr).getTime()
  const diff = now - created
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

async function handleReaction({ postId, emoji }) {
  if (!post.value) return
  const result = await toggleReaction(postId, emoji, post.value.reactions || {})
  if (result.success) {
    post.value = { ...post.value, reactions: result.reactions }
  }
}

async function handleAddComment() {
  const body = newComment.value.trim()
  if (!body) return
  try {
    const comment = await apiRequest(`${API_BASE}/posts/${post.value.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body })
    })
    post.value = {
      ...post.value,
      comments: [...(post.value.comments || []), comment]
    }
    newComment.value = ''
  } catch (err) {
    console.error('[pulse-social] Add comment error:', err)
  }
}

function canDeleteComment(comment) {
  return comment.author_uid === currentUserUid.value || isAdmin.value
}

function handleDeleteComment(commentId) {
  deletingCommentId.value = commentId
}

async function confirmDeleteComment() {
  const commentId = deletingCommentId.value
  deletingCommentId.value = null
  try {
    await apiRequest(`${API_BASE}/posts/${post.value.id}/comments/${commentId}`, { method: 'DELETE' })
    post.value = {
      ...post.value,
      comments: post.value.comments.filter(c => c.id !== commentId)
    }
  } catch (err) {
    console.error('[pulse-social] Delete comment error:', err)
  }
}

async function handleDelete() {
  showDeleteConfirm.value = false
  try {
    await apiRequest(`${API_BASE}/posts/${post.value.id}`, { method: 'DELETE' })
    nav.goBack()
  } catch (err) {
    console.error('[pulse-social] Delete post error:', err)
  }
}
</script>
