const WINDOW_MS = 60 * 60 * 1000

const LIMITS = {
  post: 20,
  comment: 60,
  reaction: 200,
  upload: 30
}

const buckets = new Map()

function getBucket(uid, action) {
  const key = `${uid}:${action}`
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    bucket = { windowStart: now, count: 0 }
    buckets.set(key, bucket)
  }
  return bucket
}

setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > WINDOW_MS * 2) {
      buckets.delete(key)
    }
  }
}, 10 * 60 * 1000).unref()

function checkRateLimit(uid, action) {
  const limit = LIMITS[action]
  if (!limit) return { allowed: true }

  const bucket = getBucket(uid, action)
  if (bucket.count >= limit) {
    const resetIn = Math.ceil((bucket.windowStart + WINDOW_MS - Date.now()) / 1000)
    return { allowed: false, resetIn, limit }
  }

  bucket.count++
  return { allowed: true, remaining: limit - bucket.count }
}

function rateLimitMiddleware(action) {
  return function(req, res, next) {
    const uid = req.userUid || req.userEmail || 'anonymous'
    const result = checkRateLimit(uid, action)
    if (!result.allowed) {
      return res.status(429).json({
        error: `Rate limit exceeded. Max ${result.limit} ${action}s per hour. Try again in ${result.resetIn}s.`
      })
    }
    next()
  }
}

module.exports = { checkRateLimit, rateLimitMiddleware, LIMITS }
