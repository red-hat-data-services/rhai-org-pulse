const VALID_LABELS = ['win', 'customer-success', 'til', 'question', 'milestone']
const VALID_EMOJIS = ['thumbsUp', 'heart', 'celebrate', 'insightful', 'curious', 'rocket']

const MAX_POST_BODY = 10000
const MIN_POST_BODY = 1
const MAX_COMMENT_BODY = 2000
const MIN_COMMENT_BODY = 1

function validatePostBody(body) {
  if (typeof body !== 'string') return 'body must be a string'
  const trimmed = body.trim()
  if (trimmed.length < MIN_POST_BODY) return 'body cannot be empty'
  if (trimmed.length > MAX_POST_BODY) return `body cannot exceed ${MAX_POST_BODY} characters`
  return null
}

function validateCommentBody(body) {
  if (typeof body !== 'string') return 'body must be a string'
  const trimmed = body.trim()
  if (trimmed.length < MIN_COMMENT_BODY) return 'body cannot be empty'
  if (trimmed.length > MAX_COMMENT_BODY) return `body cannot exceed ${MAX_COMMENT_BODY} characters`
  return null
}

function validateLabel(label) {
  if (label === null || label === undefined) return null
  if (!VALID_LABELS.includes(label)) return `label must be one of: ${VALID_LABELS.join(', ')}`
  return null
}

function validateEmoji(emoji) {
  if (!emoji || !VALID_EMOJIS.includes(emoji)) return `emoji must be one of: ${VALID_EMOJIS.join(', ')}`
  return null
}

module.exports = {
  VALID_LABELS,
  VALID_EMOJIS,
  MAX_POST_BODY,
  MAX_COMMENT_BODY,
  validatePostBody,
  validateCommentBody,
  validateLabel,
  validateEmoji
}
