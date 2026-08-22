/**
 * Normalize Features List / PM Hub row shapes for FeatureReadinessDrawer.
 */

/**
 * @param {object|null|undefined} feature
 * @returns {object|null}
 */
export function toDrawerFeature(feature) {
  if (!feature) return null
  var fixVersions = Array.isArray(feature.fixVersions) ? feature.fixVersions : []
  return Object.assign({}, feature, {
    title: feature.title || feature.summary || '',
    fixVersion: feature.fixVersion || (fixVersions.length ? fixVersions[0] : null),
    deliveryOwner: feature.deliveryOwner || feature.assignee || null,
    sourceRfe: feature.sourceRfe || feature.linkedRfeKey || null,
    dataSource: feature.dataSource || 'jira'
  })
}
