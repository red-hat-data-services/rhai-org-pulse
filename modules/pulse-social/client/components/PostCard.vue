<template>
  <article
    role="article"
    :aria-labelledby="'post-author-' + post.id"
    class="px-5 py-5 transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-800/30 group"
    :class="[highlightClass]"
    :data-post-id="post.id"
  >
    <div class="flex gap-3.5">
      <!-- Avatar column -->
      <div class="shrink-0">
        <PersonAvatar :name="post.author_name" :uid="post.author_uid" size="lg" />
      </div>

      <!-- Content column -->
      <div class="flex-1 min-w-0">
        <!-- Author row -->
        <div class="flex items-center gap-2 mb-1">
          <span :id="'post-author-' + post.id" class="font-semibold text-[15px] text-gray-900 dark:text-gray-100 truncate">
            {{ post.author_name }}
          </span>
          <span v-if="post.author_team" class="text-sm text-gray-500 dark:text-gray-400 truncate hidden sm:inline">{{ post.author_team }}</span>
          <LabelBadge v-if="post.label" :label="post.label" :resolved="!!post.resolved" />
          <span class="text-gray-300 dark:text-gray-600 hidden sm:inline">&middot;</span>
          <time :datetime="post.created_at" :title="fullDate" class="text-xs text-gray-400 dark:text-gray-500 shrink-0">{{ relativeTime }}</time>
          <span v-if="post.pinned" class="text-xs" title="Pinned">📌</span>
          <span v-if="post.edited_at" class="text-xs text-gray-400">(edited)</span>
          <span class="flex-1"></span>
          <!-- Open detail -->
          <button
            @click="$emit('open-post', post.id)"
            class="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
            title="Open post"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </button>
        </div>

        <!-- Body (clickable to open detail) -->
        <div @click="$emit('open-post', post.id)" class="text-[15px] text-gray-800 dark:text-gray-200 leading-relaxed mt-1.5 cursor-pointer">
          <div v-if="truncated && !expanded" class="line-clamp-4 post-fade">
            <MarkdownRenderer :content="post.body" />
          </div>
          <div v-else>
            <MarkdownRenderer :content="post.body" />
          </div>
          <button
            v-if="truncated && !expanded"
            @click="expanded = true"
            class="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline mt-0.5 cursor-pointer"
          >
            Show more
          </button>
        </div>

        <!-- Attachments -->
        <AttachmentPreview v-if="post.attachments?.length" :attachments="post.attachments" />

        <!-- Action bar (Twitter-style, always visible) -->
        <ReactionBar
          :reactions="post.reactions || {}"
          :comment-count="post.comment_count"
          :post-id="post.id"
          @toggle="handleReaction"
          @view-comments="toggleComments"
          class="mt-1"
        />

        <!-- Inline comments (collapsed: 1 preview + input) -->
        <div v-if="showComments" class="mt-4 animate-slideDown">
          <!-- Recent comments -->
          <div v-if="visibleComments.length > 0" class="space-y-2 mb-2">
            <div v-for="comment in visibleComments" :key="comment.id" class="flex items-start gap-2">
              <PersonAvatar :name="comment.author_name" :uid="comment.author_uid" size="xs" />
              <div class="flex-1 min-w-0">
                <div class="inline">
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ comment.author_name }}</span>
                  <span class="text-sm text-gray-700 dark:text-gray-300 ml-1"><MarkdownRenderer :content="comment.body" /></span>
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <time class="text-[10px] text-gray-400">{{ formatTime(comment.created_at) }}</time>
                </div>
              </div>
            </div>
          </div>

          <!-- View all link -->
          <button
            v-if="post.comment_count > visibleComments.length"
            @click="$emit('open-post', post.id)"
            class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline cursor-pointer mb-2"
          >
            View all {{ post.comment_count }} replies &rarr;
          </button>

          <!-- Quick reply input -->
          <InlineComment @submit="handleAddComment" />
        </div>
      </div>
    </div>
  </article>
</template>

<script setup>
import { ref, computed } from 'vue'
import PersonAvatar from './PersonAvatar.vue'
import LabelBadge from './LabelBadge.vue'
import MarkdownRenderer from './MarkdownRenderer.vue'
import AttachmentPreview from './AttachmentPreview.vue'
import ReactionBar from './ReactionBar.vue'
import InlineComment from './InlineComment.vue'

const props = defineProps({
  post: { type: Object, required: true },
  highlight: { type: Boolean, default: false }
})

const emit = defineEmits(['open-post', 'react', 'comment'])

const expanded = ref(false)
const showComments = ref(false)
const localComments = ref([])

const truncated = computed(() => {
  if (!props.post.body) return false
  return props.post.body.length > 300 || (props.post.body.match(/\n/g) || []).length > 4
})

const visibleComments = computed(() => {
  const recent = props.post.recent_comments || []
  return [...recent, ...localComments.value]
})

const highlightClass = computed(() => props.highlight ? 'post-highlight' : '')

const fullDate = computed(() => new Date(props.post.created_at).toLocaleString())

const relativeTime = computed(() => {
  const now = Date.now()
  const created = new Date(props.post.created_at).getTime()
  const diff = now - created
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(props.post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

function toggleComments() {
  showComments.value = !showComments.value
}

function handleReaction(emoji) {
  emit('react', { postId: props.post.id, emoji })
}

function handleAddComment(body) {
  emit('comment', { postId: props.post.id, body })
  localComments.value.push({
    id: 'local-' + Date.now(),
    author_uid: '',
    author_name: 'You',
    body,
    created_at: new Date().toISOString()
  })
}
</script>

<style scoped>
.post-highlight {
  animation: highlightGlow 2s ease-out forwards;
}
@keyframes highlightGlow {
  0% { background-color: rgba(59, 130, 246, 0.08); }
  100% { background-color: transparent; }
}

.post-fade {
  -webkit-mask-image: linear-gradient(to bottom, black 70%, transparent 100%);
  mask-image: linear-gradient(to bottom, black 70%, transparent 100%);
}

.animate-slideDown {
  animation: slideDown 200ms ease-out;
}
@keyframes slideDown {
  from { opacity: 0; max-height: 0; transform: translateY(-4px); }
  to { opacity: 1; max-height: 500px; transform: translateY(0); }
}
</style>
