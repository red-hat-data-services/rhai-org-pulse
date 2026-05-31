<template>
  <div class="max-w-[680px] mx-auto" role="feed" aria-label="Pulse Social feed">
    <!-- Composer -->
    <PostComposer @posted="handlePosted" class="mb-6" />

    <!-- Filter bar -->
    <FilterBar :active="feed.activeLabel.value" @filter="feed.setLabelFilter" class="mb-6" />

    <!-- Loading state (skeleton) -->
    <FeedSkeleton v-if="feed.loading.value && !feed.loadingMore.value" :count="3" />

    <!-- Error state -->
    <div v-else-if="feed.error.value" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
      {{ feed.error.value }}
    </div>

    <!-- Empty state -->
    <EmptyFeed v-else-if="feed.isEmpty.value" @compose="focusComposer" />

    <!-- Feed content -->
    <template v-else>
      <!-- Pinned posts -->
      <div v-if="feed.pinnedPosts.value.length > 0" class="space-y-4 mb-2">
        <PostCard
          v-for="post in feed.pinnedPosts.value"
          :key="post.id"
          :post="post"
          :highlight="highlightedPostId === post.id"
          @open-post="navigateToPost"
          @react="handleReaction"
          @comment="handleComment"
        />
      </div>

      <!-- Time-grouped regular posts -->
      <template v-for="group in groupedPosts" :key="group.label">
        <TimeGroup :label="group.label" />
        <div class="space-y-4">
          <PostCard
            v-for="post in group.posts"
            :key="post.id"
            :post="post"
            :highlight="highlightedPostId === post.id"
            @open-post="navigateToPost"
            @react="handleReaction"
            @comment="handleComment"
          />
        </div>
      </template>

      <!-- Load more -->
      <div v-if="feed.hasMore.value" class="py-8 text-center">
        <button
          v-if="!feed.loadingMore.value"
          @click="loadMore"
          class="px-6 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
        >
          Load more
        </button>
        <div v-else class="flex justify-center">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import PostComposer from '../components/PostComposer.vue'
import PostCard from '../components/PostCard.vue'
import FilterBar from '../components/FilterBar.vue'
import TimeGroup from '../components/TimeGroup.vue'
import EmptyFeed from '../components/EmptyFeed.vue'
import FeedSkeleton from '../components/FeedSkeleton.vue'
import { useFeed } from '../composables/useFeed'
import { useReactions } from '../composables/useReactions'

const nav = inject('moduleNav')
const feed = useFeed()
const { toggleReaction } = useReactions()
const highlightedPostId = ref(null)

onMounted(() => {
  feed.loadFeed()
})

const groupedPosts = computed(() => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const groups = []
  let currentGroup = null

  for (const post of feed.posts.value) {
    const postDate = new Date(post.created_at)
    let label
    if (postDate >= today) label = 'Today'
    else if (postDate >= yesterday) label = 'Yesterday'
    else if (postDate >= weekAgo) label = 'This Week'
    else label = 'Earlier'

    if (!currentGroup || currentGroup.label !== label) {
      currentGroup = { label, posts: [] }
      groups.push(currentGroup)
    }
    currentGroup.posts.push(post)
  }

  return groups
})

function navigateToPost(postId) {
  nav.navigateTo('post-detail', { id: postId })
}

function handlePosted(post) {
  feed.prependPost(post)
  highlightedPostId.value = post.id
  setTimeout(() => { highlightedPostId.value = null }, 2000)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function handleReaction({ postId, emoji }) {
  const post = feed.allPosts.value.find(p => p.id === postId)
  if (!post) return

  const result = await toggleReaction(postId, emoji, post.reactions || {})
  if (result.success) {
    feed.updatePostReactions(postId, result.reactions)
  }
}

async function handleComment({ postId, body }) {
  try {
    await import('@shared/client/services/api').then(({ apiRequest }) =>
      apiRequest(`/modules/pulse-social/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body })
      })
    )
    feed.incrementCommentCount(postId)
  } catch (err) {
    console.error('[pulse-social] Comment error:', err)
  }
}

function loadMore() {
  feed.loadFeed({ append: true })
}

function focusComposer() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>
