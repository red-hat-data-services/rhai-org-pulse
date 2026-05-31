const crypto = require('crypto')

function uuid() {
  return crypto.randomUUID()
}

function iso(daysAgo = 0, hoursAgo = 0) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(d.getHours() - hoursAgo)
  return d.toISOString()
}

const SAMPLE_POSTS = [
  {
    author_uid: 'jsmith',
    author_name: 'John Smith',
    author_team: 'Platform',
    label: 'win',
    body: 'Just shipped the new API caching layer! Response times dropped **40%** across all endpoints. The P95 latency went from 850ms to 320ms.\n\nBig thanks to the whole team for the thorough code reviews.',
    daysAgo: 0, hoursAgo: 2
  },
  {
    author_uid: 'mwilson',
    author_name: 'Maria Wilson',
    author_team: 'Data Science',
    label: 'til',
    body: 'TIL: `git bisect` can binary-search your commit history to find exactly which commit introduced a bug. Just run `git bisect start`, mark a known good and bad commit, and Git walks you through testing each midpoint. Game changer for tracking down regressions.',
    daysAgo: 1, hoursAgo: 3
  },
  {
    author_uid: 'rjones',
    author_name: 'Raj Jones',
    author_team: 'QE',
    label: 'customer-success',
    body: 'Customer demo with Acme Corp went incredibly well! They were particularly impressed with the new dashboard filters. Their engineering lead said "this is exactly what we\'ve been looking for."\n\nThey\'re moving forward with the enterprise plan.',
    daysAgo: 1, hoursAgo: 8
  },
  {
    author_uid: 'akumar',
    author_name: 'Alex Kumar',
    author_team: 'Platform',
    label: null,
    body: 'Heads up — we\'re planning a database migration for the staging environment this Thursday at 2pm ET. Expected downtime is ~15 minutes. I\'ll post updates in the thread.',
    daysAgo: 2, hoursAgo: 1
  },
  {
    author_uid: 'lpatel',
    author_name: 'Lena Patel',
    author_team: 'Frontend',
    label: 'milestone',
    body: '## v3.2.0 is live! 🎉\n\nThis release includes:\n- Dark mode support across all pages\n- Keyboard navigation improvements\n- 23 bug fixes from the community backlog\n\nThanks to everyone who contributed PRs and filed issues.',
    daysAgo: 3, hoursAgo: 0
  },
  {
    author_uid: 'dpark',
    author_name: 'David Park',
    author_team: 'SRE',
    label: 'question',
    body: 'Has anyone set up OpenTelemetry tracing with our Express backend? I\'m trying to get distributed traces working across the API gateway and the module endpoints. The docs are a bit sparse on the Express 5 integration.\n\nAny pointers appreciated!',
    daysAgo: 3, hoursAgo: 6
  },
  {
    author_uid: 'tnguyen',
    author_name: 'Tina Nguyen',
    author_team: 'Data Science',
    label: 'til',
    body: 'TIL: You can use `EXPLAIN QUERY PLAN` in SQLite to see how your queries are being executed and which indexes are being used. Super helpful for optimization:\n\n```sql\nEXPLAIN QUERY PLAN\nSELECT * FROM posts WHERE author_uid = ? ORDER BY created_at DESC;\n```',
    daysAgo: 4, hoursAgo: 2
  },
]

const SAMPLE_COMMENTS = [
  { postIndex: 0, author_uid: 'schen', author_name: 'Sarah Chen', body: 'Amazing work! The latency improvement is huge. 🚀', hoursAfter: 1 },
  { postIndex: 0, author_uid: 'akumar', author_name: 'Alex Kumar', body: 'What caching strategy did you end up going with? Redis or in-memory?', hoursAfter: 2 },
  { postIndex: 0, author_uid: 'jsmith', author_name: 'John Smith', body: 'In-memory LRU with a 5-minute TTL. Redis felt like overkill for our read patterns.', hoursAfter: 3 },
  { postIndex: 1, author_uid: 'dpark', author_name: 'David Park', body: 'This saved me so many hours last month when we had that flaky test.', hoursAfter: 2 },
  { postIndex: 4, author_uid: 'rjones', author_name: 'Raj Jones', body: 'The dark mode looks fantastic. Customers have been asking for this!', hoursAfter: 4 },
  { postIndex: 5, author_uid: 'tnguyen', author_name: 'Tina Nguyen', body: 'I set this up last quarter. Happy to pair with you — it\'s tricky with the async context propagation.', hoursAfter: 3 },
]

const SAMPLE_REACTIONS = [
  { postIndex: 0, user_uid: 'schen', emoji: 'rocket' },
  { postIndex: 0, user_uid: 'akumar', emoji: 'thumbsUp' },
  { postIndex: 0, user_uid: 'lpatel', emoji: 'thumbsUp' },
  { postIndex: 0, user_uid: 'mwilson', emoji: 'celebrate' },
  { postIndex: 1, user_uid: 'dpark', emoji: 'insightful' },
  { postIndex: 1, user_uid: 'jsmith', emoji: 'thumbsUp' },
  { postIndex: 1, user_uid: 'akumar', emoji: 'insightful' },
  { postIndex: 2, user_uid: 'jsmith', emoji: 'celebrate' },
  { postIndex: 2, user_uid: 'schen', emoji: 'celebrate' },
  { postIndex: 2, user_uid: 'lpatel', emoji: 'rocket' },
  { postIndex: 4, user_uid: 'jsmith', emoji: 'celebrate' },
  { postIndex: 4, user_uid: 'schen', emoji: 'rocket' },
  { postIndex: 4, user_uid: 'akumar', emoji: 'thumbsUp' },
  { postIndex: 4, user_uid: 'rjones', emoji: 'celebrate' },
  { postIndex: 4, user_uid: 'mwilson', emoji: 'celebrate' },
  { postIndex: 5, user_uid: 'schen', emoji: 'curious' },
  { postIndex: 6, user_uid: 'dpark', emoji: 'insightful' },
  { postIndex: 6, user_uid: 'jsmith', emoji: 'thumbsUp' },
]

function seed(db) {
  const insertPost = db.prepare(`
    INSERT INTO posts (id, author_uid, author_name, author_team, label, body, pinned, resolved, created_at, updated_at, edited_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, NULL)
  `)

  const insertComment = db.prepare(`
    INSERT INTO comments (id, post_id, author_uid, author_name, body, created_at, edited_at)
    VALUES (?, ?, ?, ?, ?, ?, NULL)
  `)

  const insertReaction = db.prepare(`
    INSERT INTO reactions (post_id, comment_id, user_uid, emoji, created_at)
    VALUES (?, NULL, ?, ?, ?)
  `)

  const postIds = []

  const seedAll = db.transaction(() => {
    for (const post of SAMPLE_POSTS) {
      const id = uuid()
      const createdAt = iso(post.daysAgo, post.hoursAgo)
      insertPost.run(
        id,
        post.author_uid,
        post.author_name,
        post.author_team,
        post.label,
        post.body,
        createdAt,
        createdAt
      )
      postIds.push(id)
    }

    for (const comment of SAMPLE_COMMENTS) {
      const postId = postIds[comment.postIndex]
      const postCreatedAt = new Date(SAMPLE_POSTS[comment.postIndex].daysAgo * -86400000 + Date.now())
      const commentTime = new Date(postCreatedAt.getTime() + comment.hoursAfter * 3600000)
      insertComment.run(
        uuid(),
        postId,
        comment.author_uid,
        comment.author_name,
        comment.body,
        commentTime.toISOString()
      )
    }

    for (const reaction of SAMPLE_REACTIONS) {
      const postId = postIds[reaction.postIndex]
      insertReaction.run(postId, reaction.user_uid, reaction.emoji, iso(SAMPLE_POSTS[reaction.postIndex].daysAgo, 0))
    }
  })

  seedAll()
  console.log(`[pulse-social] Seeded ${SAMPLE_POSTS.length} posts, ${SAMPLE_COMMENTS.length} comments, ${SAMPLE_REACTIONS.length} reactions`)
}

module.exports = { seed }
