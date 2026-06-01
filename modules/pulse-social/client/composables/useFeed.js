import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const API_BASE = '/modules/pulse-social'

// Singleton state: shared across all callers so the feed, composer, and
// sidebar all read/write the same reactive arrays. This is intentional for
// a single-page feed module. Do not refactor to per-instance state without
// updating all consumers.
const pinnedPosts = ref([])
const posts = ref([])
const nextCursor = ref(null)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref(null)
const activeLabel = ref(null)

export function useFeed() {
  async function loadFeed({ label, team, author, mentioning, search, append = false } = {}) {
    if (append) {
      if (!nextCursor.value || loadingMore.value) return
      loadingMore.value = true
    } else {
      loading.value = true
      error.value = null
    }

    try {
      const params = new URLSearchParams()
      if (append && nextCursor.value) params.set('before', nextCursor.value)
      if (label || activeLabel.value) params.set('label', label || activeLabel.value)
      if (team) params.set('team', team)
      if (author) params.set('author', author)
      if (mentioning) params.set('mentioning', mentioning)
      if (search) params.set('search', search)

      const qs = params.toString()
      const data = await apiRequest(`${API_BASE}/posts${qs ? '?' + qs : ''}`)

      if (append) {
        posts.value = [...posts.value, ...data.posts]
      } else {
        pinnedPosts.value = data.pinned || []
        posts.value = data.posts || []
      }
      nextCursor.value = data.nextCursor || null
    } catch (err) {
      error.value = err.message
      console.error('[pulse-social] Feed load error:', err)
    } finally {
      loading.value = false
      loadingMore.value = false
    }
  }

  function setLabelFilter(label) {
    activeLabel.value = label === activeLabel.value ? null : label
    loadFeed({ label: activeLabel.value })
  }

  function prependPost(post) {
    if (post.pinned) {
      pinnedPosts.value = [post, ...pinnedPosts.value]
    } else {
      posts.value = [post, ...posts.value]
    }
  }

  function removePost(postId) {
    pinnedPosts.value = pinnedPosts.value.filter(p => p.id !== postId)
    posts.value = posts.value.filter(p => p.id !== postId)
  }

  function updatePostReactions(postId, reactions) {
    const update = (list) => list.map(p =>
      p.id === postId ? { ...p, reactions, reaction_count: Object.values(reactions).reduce((s, c) => s + c, 0) } : p
    )
    pinnedPosts.value = update(pinnedPosts.value)
    posts.value = update(posts.value)
  }

  function incrementCommentCount(postId) {
    const update = (list) => list.map(p =>
      p.id === postId ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p
    )
    pinnedPosts.value = update(pinnedPosts.value)
    posts.value = update(posts.value)
  }

  const allPosts = computed(() => [...pinnedPosts.value, ...posts.value])
  const hasMore = computed(() => nextCursor.value !== null)
  const isEmpty = computed(() => !loading.value && pinnedPosts.value.length === 0 && posts.value.length === 0)

  return {
    pinnedPosts,
    posts,
    allPosts,
    nextCursor,
    loading,
    loadingMore,
    error,
    hasMore,
    isEmpty,
    activeLabel,
    loadFeed,
    setLabelFilter,
    prependPost,
    removePost,
    updatePostReactions,
    incrementCommentCount
  }
}
