<template>
  <div class="max-w-[680px] mx-auto">
    <!-- Back link -->
    <button
      @click="goBack"
      class="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4 cursor-pointer"
    >
      <span>&larr;</span>
      <span>Back to feed</span>
    </button>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
      {{ error }}
    </div>

    <!-- Post + Comments -->
    <template v-else-if="post">
      <!-- Post card (with reaction counts, not UID arrays) -->
      <PostCard
        :post="postForCard"
        @react="handleReaction"
      />

      <!-- Delete button (author or admin) -->
      <div v-if="canDelete" class="flex justify-end mt-2">
        <button
          @click="showDeleteConfirm = true"
          class="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
        >
          Delete post
        </button>
      </div>

      <!-- Comments section -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm mt-4 p-5">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Comments ({{ post.comments?.length || 0 }})
        </h3>
        <CommentThread
          :comments="post.comments || []"
          :current-user-uid="currentUserUid"
          :is-admin="isAdmin"
          @submit="handleAddComment"
          @delete="handleDeleteComment"
        />
      </div>
    </template>

    <!-- Not found -->
    <div v-else class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">Post not found.</p>
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
import { ref, computed, onMounted, inject } from 'vue'
import PostCard from '../components/PostCard.vue'
import CommentThread from '../components/CommentThread.vue'
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

const currentUserUid = computed(() => user.value?.uid || user.value?.email || '')
const isAdmin = computed(() => authIsAdmin.value)
const canDelete = computed(() => {
  if (!post.value) return false
  return post.value.author_uid === currentUserUid.value || isAdmin.value
})

const reactionCounts = computed(() => {
  if (!post.value?.reactions) return {}
  const counts = {}
  for (const [emoji, users] of Object.entries(post.value.reactions)) {
    counts[emoji] = Array.isArray(users) ? users.length : users
  }
  return counts
})

const postForCard = computed(() => {
  if (!post.value) return null
  return {
    ...post.value,
    reactions: reactionCounts.value,
    comment_count: post.value.comments?.length || 0,
    recent_comments: []
  }
})

onMounted(async () => {
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

function goBack() {
  nav.goBack()
}

async function handleReaction({ postId, emoji }) {
  if (!post.value) return
  const result = await toggleReaction(postId, emoji, post.value.reactions || {})
  if (result.success) {
    post.value = { ...post.value, reactions: result.reactions }
  }
}

async function handleAddComment(body) {
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
  } catch (err) {
    console.error('[pulse-social] Add comment error:', err)
  }
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
