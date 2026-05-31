import { apiRequest } from '@shared/client/services/api'

const API_BASE = '/modules/pulse-social'

export function useReactions() {
  async function toggleReaction(postId, emoji, currentReactions) {
    try {
      const result = await apiRequest(`${API_BASE}/posts/${postId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji })
      })

      const updated = { ...currentReactions }
      if (result.action === 'added') {
        updated[emoji] = (updated[emoji] || 0) + 1
      } else if (result.action === 'removed') {
        updated[emoji] = Math.max(0, (updated[emoji] || 0) - 1)
        if (updated[emoji] === 0) delete updated[emoji]
      }
      return { reactions: updated, success: true }
    } catch (err) {
      console.error('[pulse-social] Reaction toggle error:', err)
      return { reactions: currentReactions, success: false }
    }
  }

  async function fetchReactionDetails(postId) {
    try {
      const data = await apiRequest(`${API_BASE}/posts/${postId}/reactions`)
      return data.reactions
    } catch (err) {
      console.error('[pulse-social] Fetch reactions error:', err)
      return {}
    }
  }

  return { toggleReaction, fetchReactionDetails }
}
