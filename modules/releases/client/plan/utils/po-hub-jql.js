const TARGET_VERSIONS_BY_RELEASE = {
  'rhoai-3.5.EA2': ['3.5 EA2 RHOAI RELEASE', '3.5 EA2 RHAII RELEASE', '3.5 EA2 RHELAI RELEASE'],
  'rhoai-3.6.EA2': ['3.6 EA2 RHOAI RELEASE', '3.6 EA2 RHAII RELEASE', '3.6 EA2 RHELAI RELEASE'],
  'rhoai-3.6.GA': ['3.6 GA RHOAI RELEASE', '3.6 GA RHAII RELEASE', '3.6 GA RHELAI RELEASE'],
}

const ISSUE_KEY = /^[A-Z][A-Z0-9]+-\d+$/

function appendFilter(jql, filter) {
  if (!jql || !filter) return null
  const orderBy = jql.search(/\s+ORDER BY\b/i)
  if (orderBy < 0) return `${jql} AND (${filter})`
  return `${jql.slice(0, orderBy)} AND (${filter})${jql.slice(orderBy)}`
}

function releaseKeys(selectedReleases, releases, kind) {
  const releaseByName = new Map((releases || []).map(release => [release.name, release]))
  return [...new Set(selectedReleases.flatMap(name => (releaseByName.get(name)?.[kind] || []).map(issue => issue.key)).filter(key => ISSUE_KEY.test(key)))]
}

function scopedVersionFilter(selectedReleases, releases, kind) {
  const clauses = []
  const versions = [...new Set(selectedReleases.flatMap(release => TARGET_VERSIONS_BY_RELEASE[release] || []))]
  if (versions.length > 0) {
    const values = versions.map(version => `"${version}"`).join(', ')
    clauses.push(`("Target Version" in (${values}) OR ("Target Version" is EMPTY AND fixVersion in (${values})))`)
  }
  if (selectedReleases.includes('Unversioned / Cross-Release')) {
    clauses.push('("Target Version" is EMPTY AND fixVersion is EMPTY)')
  }
  if (selectedReleases.includes('Other releases')) {
    const keys = releaseKeys(['Other releases'], releases, kind)
    if (keys.length > 0) clauses.push(`key in (${keys.join(', ')})`)
  }
  return clauses.join(' OR ')
}

export function buildPoHubJqlSections(queries, selectedReleases, releases) {
  if (!selectedReleases.length) return []
  const featureKeys = releaseKeys(selectedReleases, releases, 'features')
  const initiativeKeys = releaseKeys(selectedReleases, releases, 'initiatives')
  const rankKeys = [...new Set([...featureKeys, ...initiativeKeys])]
  const strategyFilter = scopedVersionFilter(selectedReleases, releases, 'strategies')
  const epicFilter = scopedVersionFilter(selectedReleases, releases, 'epics')

  return [
    { title: 'RHAISTRAT Strategies', query: appendFilter(queries.strategies, strategyFilter) },
    { title: 'AIPCC and PACKAGE Epics', query: appendFilter(queries.epics, epicFilter), note: 'Epics with the exact package label appear under PACKAGE; all other results appear under AIPCC.' },
    { title: 'Plan ranking', query: rankKeys.length ? appendFilter(queries.rank, `key in (${rankKeys.join(', ')})`) : null, note: 'Orders the selected Features and Initiatives.' },
    { title: 'Features', query: featureKeys.length ? appendFilter(queries.features, `key in (${featureKeys.join(', ')})`) : null, note: 'Scoped to the loaded release because Feature lanes are inferred from summaries.' },
    { title: 'Initiatives', query: initiativeKeys.length ? appendFilter(queries.initiatives, `key in (${initiativeKeys.join(', ')})`) : null, note: 'Scoped to the loaded release because Initiative lanes are inferred from summaries.' },
    ...Object.entries(queries.packageRequests || {})
      .filter(([release]) => selectedReleases.includes(release))
      .map(([release, query]) => ({ title: `${release} package requests`, query })),
    { title: '3.6 EA2 packages ready to close', query: selectedReleases.includes('rhoai-3.6.EA2') ? queries.reviewReadyPackages : null, note: 'Keeps Epics with the exact package label, at least one direct Story, and all direct Stories Closed.' },
  ].filter(section => section.query)
}
