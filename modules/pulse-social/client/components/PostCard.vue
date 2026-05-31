<template>
  <article
    role="article"
    :aria-labelledby="'post-author-' + post.id"
    class="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200"
    :class="[borderClass, pinnedClass, highlightClass]"
    :data-post-id="post.id"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <div class="p-5">
      <!-- Author row -->
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-start gap-3">
          <PersonAvatar :name="post.author_name" :uid="post.author_uid" size="md" />
          <div>
            <div :id="'post-author-' + post.id" class="font-medium text-gray-900 dark:text-gray-100 text-[15px]">
              {{ post.author_name }}
            </div>
            <div class="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <span v-if="post.author_team">{{ post.author_team }}</span>
              <span v-if="post.author_team && post.label" class="text-gray-300 dark:text-gray-600">&middot;</span>
              <LabelBadge :label="post.label" :resolved="!!post.resolved" />
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 shrink-0">
          <span v-if="post.pinned" title="Pinned">📌</span>
          <span v-if="post.edited_at" title="Edited">(edited)</span>
          <time :datetime="post.created_at" :title="fullDate">{{ relativeTime }}</time>
        </div>
      </div>

      <!-- Body -->
      <div class="text-[15px] text-gray-800 dark:text-gray-200 leading-relaxed">
        <div v-if="truncated && !expanded" class="line-clamp-4">
          <MarkdownRenderer :content="post.body" />
        </div>
        <div v-else>
          <MarkdownRenderer :content="post.body" />
        </div>
        <button
          v-if="truncated && !expanded"
          @click="expanded = true"
          class="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline mt-1 cursor-pointer"
        >
          Read more
        </button>
      </div>

      <!-- Attachments -->
      <AttachmentPreview v-if="post.attachments?.length" :attachments="post.attachments" />

      <!-- Reactions + Comment count -->
      <div class="mt-4">
        <ReactionBar
          :reactions="post.reactions || {}"
          :comment-count="post.comment_count"
          :post-id="post.id"
          :hovered="hovered"
          @toggle="handleReaction"
          @view-comments="toggleComments"
        />
      </div>
    </div>

    <!-- Inline comments section (LinkedIn-style) -->
    <div v-if="showComments" class="border-t border-gray-100 dark:border-gray-700 px-5 py-4 bg-gray-50/50 dark:bg-gray-800/80">
      <!-- Recent comments -->
      <div v-if="visibleComments.length > 0" class="space-y-3 mb-3">
        <div v-for="comment in visibleComments" :key="comment.id" class="flex items-start gap-2.5">
          <PersonAvatar :name="comment.author_name" :uid="comment.author_uid" size="xs" />
          <div class="flex-1 min-w-0 bg-white dark:bg-gray-700 rounded-lg px-3 py-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium text-gray-900 dark:text-gray-100">{{ comment.author_name }}</span>
              <time class="text-[10px] text-gray-400 dark:text-gray-500">{{ formatTime(comment.created_at) }}</time>
              <span v-if="comment.edited_at" class="text-[10px] text-gray-400">(edited)</span>
            </div>
            <div class="text-sm text-gray-700 dark:text-gray-300 mt-0.5 leading-relaxed">
              <MarkdownRenderer :content="comment.body" />
            </div>
          </div>
        </div>
      </div>

      <!-- View all comments link -->
      <button
        v-if="post.comment_count > visibleComments.length"
        @click="$emit('open-post', post.id)"
        class="text-xs text-primary-600 dark:text-primary-400 hover:underline cursor-pointer mb-3"
      >
        View all {{ post.comment_count }} comments
      </button>

      <!-- Inline comment input -->
      <InlineComment @submit="handleAddComment" />
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

const hovered = ref(false)
const expanded = ref(false)
const showComments = ref(false)
const localComments = ref([])

const truncated = computed(() => {
  if (!props.post.body) return false
  return props.post.body.length > 400 || (props.post.body.match(/\n/g) || []).length > 4
})

const visibleComments = computed(() => {
  const recent = props.post.recent_comments || []
  return [...recent, ...localComments.value]
})

const LABEL_BORDERS = {
  'win': 'border-l-[3px] border-l-amber-400 dark:border-l-amber-500',
  'customer-success': 'border-l-[3px] border-l-green-400 dark:border-l-green-500',
  'til': 'border-l-[3px] border-l-purple-400 dark:border-l-purple-500',
  'question': 'border-l-[3px] border-l-orange-400 dark:border-l-orange-500',
  'milestone': 'border-l-[3px] border-l-blue-400 dark:border-l-blue-500'
}

const borderClass = computed(() => LABEL_BORDERS[props.post.label] || '')
const pinnedClass = computed(() => props.post.pinned ? 'bg-primary-50/50 dark:bg-primary-900/10' : '')
const highlightClass = computed(() => props.highlight ? 'ring-2 ring-primary-300 dark:ring-primary-600 animate-highlight' : '')

const fullDate = computed(() => new Date(props.post.created_at).toLocaleString())

const relativeTime = computed(() => {
  const now = Date.now()
  const created = new Date(props.post.created_at).getTime()
  const diff = now - created
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w`
  return new Date(props.post.created_at).toLocaleDateString()
})

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
    created_at: new Date().toISOString(),
    edited_at: null
  })
}
</script>

<style scoped>
@keyframes highlightFade {
  0% { box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3); }
  100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
}
.animate-highlight {
  animation: highlightFade 1s ease-out forwards;
}
</style>
