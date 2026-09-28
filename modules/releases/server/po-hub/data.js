const PACKAGE_RELEASE_VERSIONS = ['rhoai-3.5.EA2']
const RELEASE_VERSIONS = [...PACKAGE_RELEASE_VERSIONS, 'rhoai-3.6.EA2', 'rhoai-3.6.GA']
const OTHER_RELEASE_KEY = 'other-releases'
const REVIEW_READY_PACKAGE_RELEASE = 'rhoai-3.6.EA2'
const PLAN_RANK_JQL = 'project = "AIPCC" AND issuetype in (Initiative, Feature) AND status != Closed ORDER BY Rank ASC'
const FEATURE_JQL = 'project = "AIPCC" AND component = "AIPCC Ecosystems" AND issuetype = Feature AND status != Closed'
const INITIATIVE_JQL = 'project = "AIPCC" AND component = "AIPCC Ecosystems" AND issuetype = Initiative AND status != Closed'
const PACKAGE_REQUEST_JQL_BY_RELEASE = Object.fromEntries(PACKAGE_RELEASE_VERSIONS.map(version => [
  version,
  `project = "AIPCC" AND component = "AIPCC Ecosystems" AND issuetype = Epic AND status != Closed AND labels in (dashboard-filed, package, package-automation-onboard) AND "Target Version[version picker (multiple versions)]" = "${version}"`,
]))
const REVIEW_READY_PACKAGE_JQL = `project = AIPCC
AND issuetype = Epic
AND status = Review
AND "Target Version" in ("3.6 EA2 RHOAI RELEASE", "3.6 EA2 RHAII RELEASE", "3.6 EA2 RHELAI RELEASE")
ORDER BY Rank ASC`
const STRATEGY_JQL = `project = RHAISTRAT AND issuetype = Feature AND component IN ("AIPCC Productization", "AIPCC Ecosystems") AND status != Closed AND (labels is EMPTY OR labels != "do-not-track") ORDER BY "cf[10855]" ASC, Rank ASC`
const EPIC_JQL = `((project = RHAI and issuetype = Epic and component IN ("AIPCC Productization", "AIPCC Ecosystems") and status != Closed and (labels IN ("aipcc-ecosystems-portfolio-tracking", "package") or parent is empty)) or (project = AIPCC and issuetype = Epic and labels IN ("aipcc-ecosystems-portfolio-tracking", "package") and status != Closed)) and (labels is empty or labels != "do-not-track") ORDER BY "cf[10855]" ASC, Rank ASC`
const PO_HUB_JQL = {
  rank: PLAN_RANK_JQL,
  features: FEATURE_JQL,
  packageRequests: PACKAGE_REQUEST_JQL_BY_RELEASE,
  reviewReadyPackages: REVIEW_READY_PACKAGE_JQL,
  initiatives: INITIATIVE_JQL,
  strategies: STRATEGY_JQL,
  epics: EPIC_JQL,
}
const STATUS_ORDER = { 'Blocked': 0, 'In Progress': 1, 'Approved': 2, 'Review': 2, 'Refinement': 3, 'To Do': 4, 'New': 5, 'Closed': 6 }
const CACHE_TTL = 5 * 60 * 1000

/** Build the PO Hub data from Org Pulse's credential-bound Jira client. */
function createPoHubService(jira) {
  if (!jira || typeof jira.fetchAllJqlResults !== 'function') {
    throw new Error('PO Hub requires a Jira client')
  }

  let cachedData = null
  let cacheTimestamp = 0
  let backlogInFlight = null

  function clearCache() { cachedData = null; cacheTimestamp = 0 }

  async function fetchAllJql(jql, fields) {
    return jira.fetchAllJqlResults(jql, fields)
  }

  function username(user) {
    if (!user) return null
    if (user.emailAddress) return user.emailAddress.replace(/@redhat\.com$/, '')
    return user.displayName || null
  }

  function inferVersion(summary) {
    const s = summary.toLowerCase()
    if (s.includes('3.5-ea2') || s.includes('3.5 ea2')) return 'rhoai-3.5.EA2'
    if (s.includes('3.5 ga') || s.includes('3.5-ga')) return 'rhoai-3.5'
    if (s.includes('3.6 ea1') || s.includes('3.6-ea1') || s.includes('[3.6 ea1]')) return 'rhoai-3.6.EA1'
    if (s.includes('3.6 ea2') || s.includes('3.6-ea2') || s.includes('[3.6 ea2]')) return 'rhoai-3.6.EA2'
    if (s.includes('3.6 ga') || s.includes('3.6-ga') || s.includes('[3.6 ga]')) return 'rhoai-3.6.GA'
    if (s.includes('3.4')) return 'rhoai-3.5.EA2'
    return null
  }

  function releaseKeysForVersions(versions) {
    const releaseKeys = new Set()
    for (const version of versions) {
      const name = version.toLowerCase()
      if (name.includes('3.5 ea2') || name.includes('rhoai-3.5.ea2')) releaseKeys.add('rhoai-3.5.EA2')
      else if (name.includes('3.5 ga') || name === 'rhoai-3.5') releaseKeys.add('rhoai-3.5')
      if (name.includes('3.6 ea1') || name.includes('rhoai-3.6.ea1')) releaseKeys.add('rhoai-3.6.EA1')
      if (name.includes('3.6 ea2') || name.includes('rhoai-3.6.ea2')) releaseKeys.add('rhoai-3.6.EA2')
      if (name.includes('3.6 ga') || name.includes('rhoai-3.6.ga')) releaseKeys.add('rhoai-3.6.GA')
    }
    return [...releaseKeys]
  }

  function releaseBucketsForVersions(versions, releaseMap) {
    const visibleReleaseKeys = releaseKeysForVersions(versions).filter(releaseKey => releaseMap[releaseKey])
    if (visibleReleaseKeys.length > 0) return visibleReleaseKeys
    return [versions.length > 0 ? OTHER_RELEASE_KEY : 'unversioned']
  }

  function extractPipelineStage(labels) {
    const stages = ['package-build-failed', 'package-autoqa-passed', 'package-in-test-repo', 'package-security-blocked', 'package-autoqa-tested', 'package-automation-onboarded']
    return (labels || []).filter(l => stages.includes(l)).map(l => l.replace('package-', ''))
  }

  function extractTeam(labels) {
    const t = (labels || []).find(l => l.startsWith('team-'))
    return t ? t.replace('team-', '') : null
  }

  const SQUAD_PATTERNS = [
    { pattern: /cuda/i, squad: 'NVIDIA CUDA' },
    { pattern: /rocm/i, squad: 'AMD ROCm' },
    { pattern: /spyre/i, squad: 'IBM Spyre' },
    { pattern: /gaudi/i, squad: 'Intel Gaudi' },
    { pattern: /tpu/i, squad: 'Google TPU' },
    { pattern: /neuron/i, squad: 'AWS Neuron' },
    { pattern: /\bcpu\b/i, squad: 'CPU' },
    { pattern: /delivery/i, squad: 'Delivery' },
    { pattern: /tooling/i, squad: 'Tooling' },
  ]

  function inferSquad(summary) {
    for (const { pattern, squad } of SQUAD_PATTERNS) {
      if (pattern.test(summary)) return squad
    }
    return null
  }

  // Fetch direct children in batches instead of issuing one Jira search per parent.
  async function fetchChildrenForParents(parentKeys) {
    const keys = [...new Set(parentKeys)].filter(key => /^[A-Z][A-Z0-9]+-\d+$/.test(key))
    const byParent = new Map(keys.map(key => [key, []]))
    for (let offset = 0; offset < keys.length; offset += 50) {
      const batch = keys.slice(offset, offset + 50)
      const issues = await fetchAllJql(`parent IN (${batch.join(', ')}) ORDER BY Rank ASC`, 'key,parent,summary,status,issuetype,assignee')
      for (const issue of issues) {
        const parentKey = issue.fields?.parent?.key
        if (byParent.has(parentKey)) byParent.get(parentKey).push(issue)
      }
    }
    return byParent
  }

  // Direct children only (one level), preserving the source view's status ordering.
  function fetchChildrenShallow(parentKey, byParent, defaultType = 'Epic') {
    const childIssues = byParent.get(parentKey) || []
    const children = childIssues.map(c => ({
      key: c.key, summary: c.fields?.summary || '', status: c.fields?.status?.name || 'New',
      type: c.fields?.issuetype?.name || defaultType, assignee: username(c.fields?.assignee),
    }))
    children.sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99))
    return children
  }

  // Fetch two levels for a cohort of Features or Packages in one batch per level.
  async function fetchChildrenDeepForParents(parentKeys) {
    const childrenByParent = await fetchChildrenForParents(parentKeys)
    const childKeys = [...childrenByParent.values()].flatMap(issues => issues.map(issue => issue.key))
    const grandchildrenByParent = await fetchChildrenForParents(childKeys)
    const deepChildrenByParent = new Map()

    for (const [parentKey, childIssues] of childrenByParent) {
      const children = childIssues.map(child => {
        const grandchildren = fetchChildrenShallow(child.key, grandchildrenByParent, 'Story')
        return {
          key: child.key, summary: child.fields?.summary || '', status: child.fields?.status?.name || 'New',
          type: child.fields?.issuetype?.name || 'Epic', assignee: username(child.fields?.assignee),
          children: grandchildren,
          progress: { total: grandchildren.length, closed: grandchildren.filter(gc => gc.status === 'Closed').length },
        }
      })
      children.sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99))
      deepChildrenByParent.set(parentKey, children)
    }
    return deepChildrenByParent
  }

  async function buildBacklogData() {
    const now = Date.now()
    if (cachedData && (now - cacheTimestamp) < CACHE_TTL) return cachedData

    console.log('[releases/po-hub] Fetching backlog from Jira...')

    // Fetch combined rank for all Initiatives + Features (matches JIRA Plan ordering)
    console.log('[releases/po-hub] Fetching plan rank...')
    const rankedIssues = await fetchAllJql(
      PLAN_RANK_JQL,
      'key'
    )
    const rankMap = {}
    rankedIssues.forEach((issue, i) => { rankMap[issue.key] = i + 1 })
    console.log(`[releases/po-hub] Ranked ${rankedIssues.length} items`)

    const features = await fetchAllJql(
      FEATURE_JQL,
      'key,summary,status,priority,assignee,duedate'
    )

    const releaseMap = {}
    for (const ver of RELEASE_VERSIONS) releaseMap[ver] = { name: ver, features: [], packages: [], reviewReadyPackages: [], initiatives: [], strategies: [], epics: [], rfes: [], totalEpics: 0, closedEpics: 0 }
    releaseMap[OTHER_RELEASE_KEY] = { name: 'Other releases', features: [], packages: [], reviewReadyPackages: [], initiatives: [], strategies: [], epics: [], rfes: [], totalEpics: 0, closedEpics: 0 }
    releaseMap['unversioned'] = { name: 'Unversioned / Cross-Release', features: [], packages: [], reviewReadyPackages: [], initiatives: [], strategies: [], epics: [], rfes: [], totalEpics: 0, closedEpics: 0 }
    const featureChildrenByParent = await fetchChildrenDeepForParents(features.map(issue => issue.key))

    for (const issue of features) {
      const f = issue.fields || {}
      const key = issue.key, summary = f.summary || '', status = f.status?.name || 'New'
      const priority = f.priority?.name || 'Undefined', assignee = username(f.assignee)
      const duedate = f.duedate || null
      const inferredVersion = inferVersion(summary) || 'unversioned'
      const version = releaseMap[inferredVersion] ? inferredVersion : OTHER_RELEASE_KEY

      const children = featureChildrenByParent.get(key) || []
      const total = children.length, closed = children.filter(c => c.status === 'Closed').length

      releaseMap[version].features.push({
        key, summary, status, priority, assignee, duedate,
        rank: rankMap[key] || null,
        squad: inferSquad(summary),
        progress: { total, closed },
        flags: { blocked: children.filter(c => c.status === 'Blocked').length, unassigned: children.filter(c => !c.assignee).length },
        children,
      })
      releaseMap[version].totalEpics += total
      releaseMap[version].closedEpics += closed
    }

    for (const ver of PACKAGE_RELEASE_VERSIONS) {
      const pkgIssues = await fetchAllJql(
        PACKAGE_REQUEST_JQL_BY_RELEASE[ver],
        'key,summary,status,priority,assignee,labels,duedate'
      )
      const packageChildrenByParent = await fetchChildrenDeepForParents(pkgIssues.map(issue => issue.key))
      const pkgs = []
      for (const p of pkgIssues) {
        const f = p.fields || {}, labels = f.labels || []
        const children = packageChildrenByParent.get(p.key) || []
        pkgs.push({
          key: p.key, name: (f.summary || '').replace(' package update request', '').trim(),
          summary: f.summary || '', status: f.status?.name || 'New', priority: f.priority?.name || 'Undefined',
          assignee: username(f.assignee), duedate: f.duedate || null,
          squad: inferSquad(f.summary || ''), pipelineStage: extractPipelineStage(labels),
          children, progress: { total: children.length, closed: children.filter(c => c.status === 'Closed').length },
        })
      }
      releaseMap[ver].packages = pkgs
    }

    console.log('[releases/po-hub] Fetching 3.6 EA2 package requests ready to close...')
    const reviewPackageIssues = await fetchAllJql(
      REVIEW_READY_PACKAGE_JQL,
      'key,summary,status,priority,assignee,labels,duedate,customfield_10855'
    )
    const reviewChildrenByParent = await fetchChildrenForParents(
      reviewPackageIssues.filter(issue => (issue.fields?.labels || []).includes('package')).map(issue => issue.key)
    )
    const reviewReadyPackages = []
    for (const issue of reviewPackageIssues) {
      const f = issue.fields || {}
      if (!(f.labels || []).includes('package')) continue
      const children = fetchChildrenShallow(issue.key, reviewChildrenByParent)
      const stories = children.filter(child => child.type === 'Story')
      if (stories.length === 0 || !stories.every(story => story.status === 'Closed')) continue

      reviewReadyPackages.push({
        key: issue.key,
        name: (f.summary || '').replace(' package update request', '').trim(),
        summary: f.summary || '',
        status: f.status?.name || 'Review',
        priority: f.priority?.name || 'Undefined',
        assignee: username(f.assignee),
        duedate: f.duedate || null,
        squad: inferSquad(f.summary || ''),
        pipelineStage: extractPipelineStage(f.labels || []),
        targetVersions: (f.customfield_10855 || []).map(version => version.name),
        children: stories,
        progress: { total: stories.length, closed: stories.length },
      })
    }
    releaseMap[REVIEW_READY_PACKAGE_RELEASE].reviewReadyPackages = reviewReadyPackages
    console.log(`[releases/po-hub] Found ${reviewReadyPackages.length} package requests ready to close`)

    console.log('[releases/po-hub] Fetching Initiatives...')
    const initiatives = await fetchAllJql(
      INITIATIVE_JQL,
      'key,summary,status,priority,assignee,duedate'
    )
    const initiativeChildrenByParent = await fetchChildrenForParents(initiatives.map(issue => issue.key))

    for (const issue of initiatives) {
      const f = issue.fields || {}
      const key = issue.key, summary = f.summary || '', status = f.status?.name || 'New'
      const priority = f.priority?.name || 'Undefined', assignee = username(f.assignee)
      const duedate = f.duedate || null
      const inferredVersion = inferVersion(summary) || 'unversioned'
      const version = releaseMap[inferredVersion] ? inferredVersion : OTHER_RELEASE_KEY

      const children = fetchChildrenShallow(key, initiativeChildrenByParent)
      const total = children.length, closed = children.filter(c => c.status === 'Closed').length

      releaseMap[version].initiatives.push({
        key, summary, status, priority, assignee, duedate,
        rank: rankMap[key] || null,
        squad: inferSquad(summary),
        progress: { total, closed },
        flags: { blocked: children.filter(c => c.status === 'Blocked').length, unassigned: children.filter(c => !c.assignee).length },
        children,
      })
    }
    console.log(`[releases/po-hub] Found ${initiatives.length} Initiatives`)

    console.log('[releases/po-hub] Fetching cross-release strategies (RHAISTRAT)...')
    const strategyIssues = await fetchAllJql(
      STRATEGY_JQL,
      'key,summary,status,priority,assignee,customfield_10855,fixVersions'
    )
    const strategyChildrenByParent = await fetchChildrenForParents(strategyIssues.map(issue => issue.key))
    for (const [index, issue] of strategyIssues.entries()) {
      const f = issue.fields || {}
      const targetVersions = (f.customfield_10855 || []).map(version => version.name)
      const fixVersions = (f.fixVersions || []).map(version => version.name)
      const groupingVersions = targetVersions.length > 0 ? targetVersions : fixVersions
      const products = [...new Set(groupingVersions.flatMap(version => {
        const value = version.toUpperCase()
        return ['RHAII', 'RHOAI', 'RHELAI'].filter(product => value.includes(product))
      }))]
      const children = fetchChildrenShallow(issue.key, strategyChildrenByParent)
      const strategy = {
        order: index + 1,
        key: issue.key,
        summary: f.summary || '',
        status: f.status?.name || 'New',
        priority: f.priority?.name || 'Undefined',
        assignee: username(f.assignee),
        targetVersions,
        fixVersions,
        products,
        squad: inferSquad(f.summary || ''),
        children,
        _isStrategy: true,
      }
      for (const releaseKey of releaseBucketsForVersions(groupingVersions, releaseMap)) {
        releaseMap[releaseKey].strategies.push(strategy)
      }
    }
    console.log(`[releases/po-hub] Found ${strategyIssues.length} cross-release strategies`)

    console.log('[releases/po-hub] Fetching AIPCC Epics...')
    const epicIssues = await fetchAllJql(
      EPIC_JQL,
      'key,summary,status,priority,assignee,project,parent,labels,customfield_10855,fixVersions'
    )
    const epics = epicIssues.map((issue, index) => {
      const f = issue.fields || {}
      const labels = f.labels || []
      return {
        order: index + 1,
        key: issue.key,
        summary: f.summary || '',
        project: f.project?.key || issue.key.split('-')[0],
        status: f.status?.name || 'New',
        priority: f.priority?.name || 'Undefined',
        assignee: username(f.assignee),
        parent: f.parent?.key || null,
        labels,
        targetVersions: (f.customfield_10855 || []).map(version => version.name),
        fixVersions: (f.fixVersions || []).map(version => version.name),
        squad: inferSquad(f.summary || '') || extractTeam(labels),
        _isEpic: true,
      }
    })
    for (const epic of epics) {
      const groupingVersions = epic.targetVersions.length > 0 ? epic.targetVersions : epic.fixVersions
      for (const releaseKey of releaseBucketsForVersions(groupingVersions, releaseMap)) {
        releaseMap[releaseKey].epics.push(epic)
      }
    }
    console.log(`[releases/po-hub] Found ${epics.length} AIPCC Epics`)

    for (const release of Object.values(releaseMap)) {
      release.features.sort((a, b) => {
        const aB = a.flags.blocked > 0 ? 0 : 1, bB = b.flags.blocked > 0 ? 0 : 1
        if (aB !== bB) return aB - bB
        return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
      })
    }

    let blocked = 0, unassigned = 0, readyForReview = 0
    for (const r of Object.values(releaseMap)) {
      for (const f of r.features) { blocked += f.flags.blocked; if (!f.assignee) unassigned++; if (f.status === 'Review') readyForReview++ }
      for (const p of r.packages) {
        if (p.pipelineStage.includes('build-failed') || p.pipelineStage.includes('security-blocked')) blocked++
        if (!p.assignee) unassigned++
      }
      for (const i of r.initiatives) { blocked += i.flags.blocked; if (!i.assignee) unassigned++; if (i.status === 'Review') readyForReview++ }
      for (const strategy of (r.strategies || [])) { if (!strategy.assignee) unassigned++ }
      for (const rfe of (r.rfes || [])) { if (!rfe.assignee) unassigned++ }
    }

    const result = {
      lastUpdated: new Date().toISOString(),
      summary: { blocked, unassigned, stalled: 0, readyForReview },
      epicJql: EPIC_JQL,
      jql: PO_HUB_JQL,
      releases: [releaseMap['rhoai-3.5.EA2'], releaseMap['rhoai-3.6.EA2'], releaseMap['rhoai-3.6.GA'], releaseMap[OTHER_RELEASE_KEY], releaseMap['unversioned']],
    }

    cachedData = result
    cacheTimestamp = Date.now()
    console.log(`[releases/po-hub] Done: ${features.length} features, ${blocked} blocked, ${unassigned} unassigned`)
    return result
  }

  function fetchBacklogData({ force = false } = {}) {
    if (!force && cachedData && Date.now() - cacheTimestamp < CACHE_TTL) return Promise.resolve(cachedData)
    if (backlogInFlight) return backlogInFlight
    if (force) clearCache()
    backlogInFlight = buildBacklogData().finally(() => { backlogInFlight = null })
    return backlogInFlight
  }

  return { fetchBacklogData, clearCache }
}

module.exports = { createPoHubService, STRATEGY_JQL, EPIC_JQL, REVIEW_READY_PACKAGE_JQL, PO_HUB_JQL }
