/**
 * Centralized view-to-owner mapping, auto-populated from git history.
 *
 * Each key is "moduleSlug/viewId" and the value is { name, email } of the
 * person who first introduced that view's component file.
 *
 * This mapping is also consumed by the org-pulse chatbot integration.
 * Admin overrides (runtime) are stored separately in view-owner-overrides.json.
 */
export const viewOwners = {
  // ai-catalyst
  'ai-catalyst/board':                          { name: 'Nati Fridman',        email: 'nafridma@redhat.com' },
  'ai-catalyst/candidate-detail':               { name: 'Nati Fridman',        email: 'nafridma@redhat.com' },
  'ai-catalyst/report':                         { name: 'Nati Fridman',        email: 'nafridma@redhat.com' },
  'ai-catalyst/catalog':                        { name: 'Nati Fridman',        email: 'nati2fridman@gmail.com' },
  'ai-catalyst/showcase-detail':                { name: 'Nati Fridman',        email: 'nati2fridman@gmail.com' },

  // ai-impact
  'ai-impact/rfe-review':                       { name: 'Alex Corvin',         email: 'acorvin@redhat.com' },
  'ai-impact/feature-review':                   { name: 'Alex Corvin',         email: 'acorvin@redhat.com' },
  'ai-impact/autofix':                          { name: 'Alex Corvin',         email: 'acorvin@redhat.com' },
  'ai-impact/ai-factory-guide':                 { name: 'Alex Corvin',         email: 'acorvin@redhat.com' },
  'ai-impact/implementation':                   { name: 'Alex Corvin',         email: 'acorvin@redhat.com' },
  'ai-impact/security':                         { name: 'Alex Corvin',         email: 'acorvin@redhat.com' },
  'ai-impact/test-plan-review':                 { name: 'Kamesh Akella',       email: 'kakella@redhat.com' },
  'ai-impact/documentation':                    { name: 'tarilabs',            email: 'matteo.mortari@gmail.com' },
  'ai-impact/build-release':                    { name: 'Deepak Chourasia',    email: 'dchouras@redhat.com' },

  // customer-insights
  'customer-insights/kanban':                   { name: 'ankristo-rh',         email: 'ankristo@redhat.com' },
  'customer-insights/dashboard':                { name: 'ankristo-rh',         email: 'ankristo@redhat.com' },
  'customer-insights/roadmap':                  { name: 'ankristo-rh',         email: 'ankristo@redhat.com' },
  'customer-insights/rfe-creator':              { name: 'ankristo-rh',         email: 'ankristo@redhat.com' },
  'customer-insights/import':                   { name: 'ankristo-rh',         email: 'ankristo@redhat.com' },

  // okr-hub
  'okr-hub/timeline':                           { name: 'Saiesh Prabhu',       email: 'saprabhu@redhat.com' },
  'okr-hub/reports':                            { name: 'Saiesh Prabhu',       email: 'saprabhu@redhat.com' },
  'okr-hub/deep-dive':                          { name: 'Saiesh Prabhu',       email: 'saprabhu@redhat.com' },

  // pm-pipeline
  'pm-pipeline/planning-prep':                  { name: 'Jen Albertson',        email: 'jalberts@redhat.com' },
  'pm-pipeline/my-pipeline':                    { name: 'Jen Albertson',        email: 'jalberts@redhat.com' },
  'pm-pipeline/learn':                          { name: 'Jen Albertson',        email: 'jalberts@redhat.com' },

  // product-builds
  'product-builds/overview':                    { name: 'Giulia Naponiello',    email: 'gnaponie@redhat.com' },
  'product-builds/rhaiis':                      { name: 'Pavol Pitonak',        email: 'ppitonak@redhat.com' },
  'product-builds/rhel-ai':                     { name: 'Pavol Pitonak',        email: 'ppitonak@redhat.com' },
  'product-builds/base-images':                 { name: 'Pavol Pitonak',        email: 'ppitonak@redhat.com' },
  'product-builds/builder-images':              { name: 'Pavol Pitonak',        email: 'ppitonak@redhat.com' },
  'product-builds/series-detail':               { name: 'Giulia Naponiello',    email: 'gnaponie@redhat.com' },
  'product-builds/wheel-collections':           { name: 'Pavol Pitonak',        email: 'ppitonak@redhat.com' },
  'product-builds/drop-detail':                 { name: 'Pavol Pitonak',        email: 'ppitonak@redhat.com' },
  'product-builds/artifact-detail':             { name: 'Pavol Pitonak',        email: 'ppitonak@redhat.com' },
  'product-builds/package-analysis':            { name: 'Einat Pacifici',       email: 'epacific@redhat.com' },

  // releases
  'releases/registry':                          { name: 'Alex Corvin',         email: 'acorvin@redhat.com' },
  'releases/schedule':                          { name: 'Paul McCarthy',       email: 'pmccart@redhat.com' },
  'releases/plan':                              { name: 'Alex Corvin',         email: 'acorvin@redhat.com' },
  'releases/execute':                           { name: 'Saiesh Prabhu',         email: 'saprabhu@redhat.com' },
  'releases/feature-detail':                    { name: 'shuels2',             email: 'shuels@redhat.com' },
  'releases/deliver':                           { name: 'Alex Corvin',         email: 'acorvin@redhat.com' },
  'releases/reports':                           { name: 'Alex Corvin',         email: 'acorvin@redhat.com' },
  'releases/audit':                             { name: 'Alex Corvin',         email: 'acorvin@redhat.com' },

  // system-health
  'system-health/quality-analysis':             { name: 'Dana Gutride',        email: 'dgutride@redhat.com' },
  'system-health/component-maturity':           { name: 'Dana Gutride',        email: 'dgutride@redhat.com' },
  'system-health/disconnected-repo-detail':     { name: 'Ajay Jaganathan',     email: 'ajagan@redhat.com' },

  // team-tracker
  'team-tracker/home':                          { name: 'Dipanshu Gupta',      email: 'dipgupta@redhat.com' },
  'team-tracker/people':                        { name: 'Dipanshu Gupta',      email: 'dipgupta@redhat.com' },
  'team-tracker/reports':                       { name: 'Alex Corvin',         email: 'acorvin@redhat.com' },
  'team-tracker/org-dashboard':                 { name: 'Alex Corvin',         email: 'acorvin@redhat.com' },
  'team-tracker/org-explorer':                  { name: 'Dipanshu Gupta',      email: 'dipgupta@redhat.com' },
  'team-tracker/team-detail':                   { name: 'Alex Corvin',         email: 'acorvin@redhat.com' },
  'team-tracker/person-detail':                 { name: 'Dipanshu Gupta',      email: 'dipgupta@redhat.com' },
  'team-tracker/unassigned':                    { name: 'Alex Corvin',         email: 'acorvin@redhat.com' },
  'team-tracker/manager-dashboard':             { name: 'Alex Corvin',         email: 'acorvin@redhat.com' },
  'team-tracker/manage':                        { name: 'Alex Corvin',         email: 'acorvin@redhat.com' },
  'team-tracker/jira-taxonomy':                 { name: 'Alex Corvin',         email: 'acorvin@redhat.com' },

  // upstream-pulse
  'upstream-pulse/dashboard':                   { name: 'Dipanshu Gupta',      email: 'dipgupta@redhat.com' },
  'upstream-pulse/insights':                    { name: 'Dipanshu Gupta',      email: 'dipgupta@redhat.com' },
  'upstream-pulse/portfolio':                   { name: 'Dipanshu Gupta',      email: 'dipgupta@redhat.com' },
  'upstream-pulse/org-detail':                  { name: 'Dipanshu Gupta',      email: 'dipgupta@redhat.com' },
  'upstream-pulse/project-detail':              { name: 'Dipanshu Gupta',      email: 'dipgupta@redhat.com' },
  'upstream-pulse/strategy':                    { name: 'Dipanshu Gupta',      email: 'dipgupta@redhat.com' }
}

/**
 * Look up the owner of a view.
 * @param {string} moduleSlug
 * @param {string} viewId
 * @param {Object} [overrides] - Admin overrides from view-owner-overrides.json
 * @returns {{ name: string, email: string } | null}
 */
export function getViewOwner(moduleSlug, viewId, overrides = {}) {
  const key = `${moduleSlug}/${viewId}`
  return overrides[key] || viewOwners[key] || null
}
