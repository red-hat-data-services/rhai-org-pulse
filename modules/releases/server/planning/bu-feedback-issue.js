/**
 * Helpers for extracting process-efficiency timestamps from Jira changelog
 * on BU/SSA feedback issues.
 */

var IN_PROGRESS_STATUSES = [
  'in progress', 'in review', 'review', 'coding',
  'development', 'in development', 'testing', 'qa'
]

/**
 * Walk changelog histories oldest-first and return the ISO timestamp of
 * the first transition into an in-progress-like status.
 *
 * @param {object|null} changelog - Jira issue changelog (from expand=changelog)
 * @returns {string|null} ISO timestamp or null
 */
function extractFirstInProgressAt(changelog) {
  if (!changelog || !Array.isArray(changelog.histories)) return null

  var histories = changelog.histories.slice().sort(function(a, b) {
    if (a.created < b.created) return -1
    if (a.created > b.created) return 1
    return 0
  })

  for (var i = 0; i < histories.length; i++) {
    var items = histories[i].items || []
    for (var j = 0; j < items.length; j++) {
      var item = items[j]
      if (item.field === 'status' && item.toString) {
        if (IN_PROGRESS_STATUSES.indexOf(item.toString.toLowerCase()) !== -1) {
          return histories[i].created
        }
      }
    }
  }

  return null
}

module.exports = { extractFirstInProgressAt, IN_PROGRESS_STATUSES }
