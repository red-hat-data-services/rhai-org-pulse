<template>
  <div class="max-w-[680px] mx-auto py-6 px-4">
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
    <!-- Profile header with stats -->
    <div class="px-4 py-6 border-b border-gray-100 dark:border-gray-700/50">
      <div class="flex items-center gap-4">
        <PersonAvatar :name="userName" :uid="userUid" size="xl" />
        <div class="flex-1">
          <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ userName }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">Your posts and activity</p>
          <!-- Stats -->
          <div class="flex items-center gap-4 mt-2">
            <div class="text-sm">
              <span class="font-semibold text-gray-900 dark:text-gray-100">{{ posts.length }}</span>
              <span class="text-gray-500 dark:text-gray-400 ml-1">posts</span>
            </div>
            <div class="text-sm">
              <span class="font-semibold text-gray-900 dark:text-gray-100">{{ totalReactions }}</span>
              <span class="text-gray-500 dark:text-gray-400 ml-1">reactions</span>
            </div>
            <div class="text-sm">
              <span class="font-semibold text-gray-900 dark:text-gray-100">{{ totalComments }}</span>
              <span class="text-gray-500 dark:text-gray-400 ml-1">replies</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-primary-600"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="mx-4 my-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
      {{ error }}
    </div>

    <!-- Empty -->
    <div v-else-if="posts.length === 0" class="text-center py-12 px-4">
      <div class="text-4xl mb-3">✍️</div>
      <p class="text-gray-500 dark:text-gray-400 mb-4">You haven't posted anything yet.</p>
      <button
        @click="goToFeed"
        class="px-5 py-2 text-sm font-semibold bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors cursor-pointer"
      >
        Write your first post
      </button>
    </div>

    <!-- Posts list -->
    <div v-else class="divide-y divide-gray-100 dark:divide-gray-700/50">
      <PostCard
        v-for="post in posts"
        :key="post.id"
        :post="post"
        @open-post="navigateToPost"
        @react="handleReaction"
        @comment="handleComment"
      />

      <!-- Load more -->
      <div v-if="nextCursor" class="py-6 text-center">
        <button
          @click="loadMore"
          class="px-5 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-full transition-colors cursor-pointer"
        >
          Show more posts
        </button>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import PostCard from '../components/PostCard.vue'
import PersonAvatar from '../components/PersonAvatar.vue'
import { useReactions } from '../composables/useReactions'
import { useAuth } from '@shared/client/composables/useAuth'
import { apiRequest } from '@shared/client/services/api'

const API_BASE = '/modules/pulse-social'

const nav = inject('moduleNav')
const { toggleReaction } = useReactions()
const { user } = useAuth()

const posts = ref([])
const loading = ref(true)
const error = ref(null)
const nextCursor = ref(null)
const userName = ref('You')
const userUid = ref('')

const totalReactions = computed(() => {
  return posts.value.reduce((sum, p) => sum + (p.reaction_count || Object.values(p.reactions || {}).reduce((s, c) => s + c, 0)), 0)
})

const totalComments = computed(() => {
  return posts.value.reduce((sum, p) => sum + (p.comment_count || 0), 0)
})

onMounted(async () => {
  if (user.value) {
    userName.value = user.value.name || user.value.email || 'You'
    userUid.value = user.value.uid || user.value.email || ''
  }
  await loadPosts()
})

async function loadPosts(append = false) {
  if (!append) loading.value = true
  error.value = null

  try {
    const params = new URLSearchParams({ mine: 'true' })
    if (append && nextCursor.value) params.set('before', nextCursor.value)

    const data = await apiRequest(`${API_BASE}/posts?${params}`)
    if (append) {
      posts.value = [...posts.value, ...(data.posts || [])]
    } else {
      posts.value = [...(data.pinned || []), ...(data.posts || [])]
    }
    nextCursor.value = data.nextCursor || null
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function loadMore() { loadPosts(true) }

function navigateToPost(postId) {
  nav.navigateTo('post-detail', { id: postId })
}

function goToFeed() { nav.navigateTo('feed') }

async function handleReaction({ postId, emoji }) {
  const post = posts.value.find(p => p.id === postId)
  if (!post) return
  const result = await toggleReaction(postId, emoji, post.reactions || {})
  if (result.success) {
    posts.value = posts.value.map(p =>
      p.id === postId ? { ...p, reactions: result.reactions } : p
    )
  }
}

async function handleComment({ postId, body }) {
  try {
    await apiRequest(`${API_BASE}/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body })
    })
    posts.value = posts.value.map(p =>
      p.id === postId ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p
    )
  } catch (err) {
    console.error('[pulse-social] Comment error:', err)
  }
}
</script>
