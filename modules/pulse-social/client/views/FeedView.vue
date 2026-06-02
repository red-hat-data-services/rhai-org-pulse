<template>
  <div class="flex gap-6 max-w-[1000px] mx-auto py-6 px-4" role="feed" aria-label="Pulse Social feed">
    <!-- Main feed column -->
    <div class="flex-1 min-w-0">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
        <!-- Composer -->
        <PostComposer @posted="handlePosted" />

        <!-- Active filter indicator -->
        <div v-if="feed.activeLabel.value" class="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-700/20">
          <span class="text-sm text-gray-600 dark:text-gray-400">
            Showing <span class="font-semibold text-gray-900 dark:text-gray-100">{{ activeLabelDisplay }}</span> posts
          </span>
          <button
            @click="feed.setLabelFilter(null)"
            class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
          >
            Clear filter
          </button>
        </div>

        <!-- Loading state -->
        <FeedSkeleton v-if="feed.loading.value && !feed.loadingMore.value" :count="3" />

        <!-- Error state -->
        <div v-else-if="feed.error.value" class="mx-5 my-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
          {{ feed.error.value }}
        </div>

        <!-- Empty state -->
        <EmptyFeed v-else-if="feed.isEmpty.value" @compose="focusComposer" />

        <!-- Feed content -->
        <template v-else>
          <!-- Pinned posts -->
          <div v-if="feed.pinnedPosts.value.length > 0" class="divide-y divide-gray-100 dark:divide-gray-700/50">
            <PostCard
              v-for="post in feed.pinnedPosts.value"
              :key="post.id"
              :post="post"
              :highlight="highlightedPostId === post.id"
              @open-post="navigateToPost"
              @react="handleReaction"
              @comment="handleComment"
              @delete-post="handleDeletePost"
            />
          </div>

          <!-- Time-grouped regular posts -->
          <template v-for="group in groupedPosts" :key="group.label">
            <TimeGroup :label="group.label" />
            <div class="divide-y divide-gray-100 dark:divide-gray-700/50">
              <PostCard
                v-for="post in group.posts"
                :key="post.id"
                :post="post"
                :highlight="highlightedPostId === post.id"
                @open-post="navigateToPost"
                @react="handleReaction"
                @comment="handleComment"
                @delete-post="handleDeletePost"
              />
            </div>
          </template>

          <!-- Load more -->
          <div v-if="feed.hasMore.value" class="py-6 text-center border-t border-gray-100 dark:border-gray-700/50">
            <button
              v-if="!feed.loadingMore.value"
              @click="loadMore"
              class="px-5 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-full transition-colors cursor-pointer"
            >
              Show more posts
            </button>
            <div v-else class="flex justify-center">
              <div class="animate-spin rounded-full h-5 w-5 border-2 border-gray-200 border-t-primary-600"></div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Right sidebar (hidden on small screens) -->
    <aside class="hidden lg:block w-[280px] shrink-0">
      <div class="sticky top-20 space-y-4">
        <!-- Activity stats -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-5">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Activity</h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700/40">
              <div class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ stats.postsThisWeek }}</div>
              <div class="text-[11px] text-gray-500 dark:text-gray-400">posts this week</div>
            </div>
            <div class="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700/40">
              <div class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ stats.totalReactions }}</div>
              <div class="text-[11px] text-gray-500 dark:text-gray-400">reactions</div>
            </div>
          </div>
        </div>

        <!-- Trending labels -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-5">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Trending</h3>
          <div class="space-y-2.5">
            <button
              v-for="label in trendingLabels"
              :key="label.key"
              @click="feed.setLabelFilter(feed.activeLabel.value === label.key ? null : label.key)"
              class="flex items-center justify-between w-full text-left px-2 py-1.5 rounded-lg transition-colors cursor-pointer group"
              :class="feed.activeLabel.value === label.key
                ? 'bg-primary-50 dark:bg-primary-900/20'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'"
            >
              <span class="text-sm group-hover:text-gray-900 dark:group-hover:text-gray-100" :class="feed.activeLabel.value === label.key ? 'font-semibold text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'">{{ label.icon }} {{ label.display }}</span>
              <span class="text-xs" :class="feed.activeLabel.value === label.key ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-gray-400 dark:text-gray-500'">{{ label.count }}</span>
            </button>
          </div>
        </div>

        <!-- Quick links -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-5">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Quick Links</h3>
          <div class="space-y-1.5">
            <button
              @click="navigateToMyPosts"
              class="flex items-center gap-2 w-full text-left px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors cursor-pointer text-sm text-gray-700 dark:text-gray-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              My Posts
            </button>
            <button
              @click="feed.setLabelFilter('question')"
              class="flex items-center gap-2 w-full text-left px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors cursor-pointer text-sm text-gray-700 dark:text-gray-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              Open Questions
            </button>
            <button
              @click="feed.setLabelFilter('win')"
              class="flex items-center gap-2 w-full text-left px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors cursor-pointer text-sm text-gray-700 dark:text-gray-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>
              Recent Wins
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Delete confirmation modal -->
    <ConfirmDialog
      :visible="!!deletingPostId"
      title="Delete this post?"
      message="This will permanently delete the post and all its comments. This can't be undone."
      confirm-label="Delete"
      @confirm="confirmDeletePost"
      @cancel="deletingPostId = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import PostComposer from '../components/PostComposer.vue'
import PostCard from '../components/PostCard.vue'
import TimeGroup from '../components/TimeGroup.vue'
import EmptyFeed from '../components/EmptyFeed.vue'
import FeedSkeleton from '../components/FeedSkeleton.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useFeed } from '../composables/useFeed'
import { useReactions } from '../composables/useReactions'

const nav = inject('moduleNav')
const feed = useFeed()
const { toggleReaction } = useReactions()
const highlightedPostId = ref(null)
const deletingPostId = ref(null)

const stats = ref({ postsThisWeek: 0, totalReactions: 0, postersThisWeek: 0, totalComments: 0 })
const trendingLabels = ref([])

onMounted(() => {
  feed.loadFeed()
  loadSidebarData()
})

const LABEL_ICONS = { 'win': '🏆', 'til': '💡', 'customer-success': '🤝', 'question': '❓', 'milestone': '🎯' }
const LABEL_NAMES = { 'win': 'Wins', 'til': 'TIL', 'customer-success': 'Customer', 'question': 'Questions', 'milestone': 'Milestones' }

const activeLabelDisplay = computed(() => LABEL_NAMES[feed.activeLabel.value] || feed.activeLabel.value)

async function loadSidebarData() {
  try {
    const { apiRequest } = await import('@shared/client/services/api')
    const data = await apiRequest('/modules/pulse-social/stats')
    stats.value = {
      postsThisWeek: data.posts_this_week || 0,
      totalReactions: data.total_reactions || 0,
      postersThisWeek: data.posters_this_week || 0,
      totalComments: data.total_comments || 0
    }
    trendingLabels.value = (data.label_distribution || []).slice(0, 5).map(l => ({
      key: l.label,
      display: LABEL_NAMES[l.label] || l.label,
      icon: LABEL_ICONS[l.label] || '',
      count: l.count
    }))
  } catch {
    // Sidebar data is non-critical
  }
}

function navigateToMyPosts() {
  nav.navigateTo('my-posts')
}

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
    feed.updatePostReactions(postId, result.reactions, emoji)
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

function handleDeletePost(postId) {
  deletingPostId.value = postId
}

async function confirmDeletePost() {
  const postId = deletingPostId.value
  deletingPostId.value = null
  try {
    const { apiRequest } = await import('@shared/client/services/api')
    await apiRequest(`/modules/pulse-social/posts/${postId}`, { method: 'DELETE' })
    feed.removePost(postId)
  } catch (err) {
    console.error('[pulse-social] Delete error:', err)
  }
}
</script>
