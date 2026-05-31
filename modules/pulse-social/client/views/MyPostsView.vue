<template>
  <div class="max-w-[680px] mx-auto">
    <div class="mb-6">
      <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">My Posts</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400">Your shared updates, wins, and milestones</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
      {{ error }}
    </div>

    <!-- Empty -->
    <div v-else-if="posts.length === 0" class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400 mb-4">You haven't posted anything yet.</p>
      <button
        @click="goToFeed"
        class="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors cursor-pointer"
      >
        Go to Feed
      </button>
    </div>

    <!-- Posts list -->
    <div v-else class="space-y-4">
      <PostCard
        v-for="post in posts"
        :key="post.id"
        :post="post"
        @view-comments="navigateToPost"
        @react="handleReaction"
      />

      <!-- Load more -->
      <div v-if="nextCursor" class="py-6 text-center">
        <button
          @click="loadMore"
          class="px-6 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
        >
          Load more
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue'
import PostCard from '../components/PostCard.vue'
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

onMounted(async () => {
  await loadPosts()
})

async function loadPosts(append = false) {
  if (!append) loading.value = true
  error.value = null

  try {
    const uid = user.value?.uid || user.value?.email || ''
    const params = new URLSearchParams({ author: uid })
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

function loadMore() {
  loadPosts(true)
}

function navigateToPost(postId) {
  nav.navigateTo('post-detail', { id: postId })
}

function goToFeed() {
  nav.navigateTo('feed')
}

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
</script>
