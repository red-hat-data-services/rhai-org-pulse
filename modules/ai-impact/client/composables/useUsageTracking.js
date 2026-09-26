// Temporary usage measurement for AISDLC-2 (which AI Impact features each persona uses).
// Records WHICH control was used, never what was typed or which work item was opened.
// See ../../USAGE-TRACKING.md for the naming convention.
import { watch, onMounted, onBeforeUnmount, getCurrentInstance } from 'vue'
import { trackUsage } from '@shared/client/services/usageTracking.js'

const LINK_KINDS = [
  ['jira', /jira|atlassian/],
  ['github', /github/],
  ['gitlab', /gitlab/],
  ['slack', /slack/],
  ['google', /google/],
]

// Host category only. Paths carry issue keys, so they are never read.
function linkKind(url) {
  const match = LINK_KINDS.find(([, re]) => re.test(url.hostname))
  return match ? match[0] : 'other'
}

let lastView = null
let lastViewLeftAt = 0

function currentViewId() {
  return window.location.hash.slice(2).split('?')[0].split('/')[1] || null
}

/**
 * Watch a component's own state and report how it is used.
 *   filter: { name: ref }  -> filter:<name>  when the value leaves its initial state
 *   search: ref            -> search         once per search (empty -> non-empty); text is not sent
 *   open:   { name: ref }  -> open:<name>    when a detail panel or modal gets a subject
 *   tab:    ref            -> tab:<value>    values must be fixed ids from the template
 *   toggle: { name: ref }  -> button:<name>  on every change (expand/collapse, popovers)
 * ponytail: resets back to the initial value (programmatic or by the user) are not reported.
 */
export function trackRefs({ filter = {}, search, open = {}, toggle = {}, tab, page } = {}) {
  for (const [name, source] of Object.entries(filter)) {
    const initial = JSON.stringify(source.value)
    watch(source, v => { if (JSON.stringify(v) !== initial) trackUsage('filter', name, page) }, { deep: true })
  }
  if (search) watch(search, (v, old) => { if (v && !old) trackUsage('search', undefined, page) })
  for (const [name, source] of Object.entries(open)) {
    watch(source, (v, old) => { if (v && !old) trackUsage('open', name, page) })
  }
  for (const [name, source] of Object.entries(toggle)) {
    watch(source, () => trackUsage('button', name, page))
  }
  if (tab) watch(tab, v => { if (v) trackUsage('tab', String(v), page) })
}

/**
 * Call once per view (or home-page widget, with `page`). While mounted, reports:
 *   - clicks on elements with data-track="action:detail"
 *   - clicks on outbound links, as link:<jira|github|gitlab|slack|google|other>
 *   - arrival from another AI Impact view, as nav:from-<viewId>
 */
export function useUsageTracking(options = {}) {
  const { page } = options
  const instance = getCurrentInstance()
  trackRefs(options)

  function onClick(e) {
    // Views listen on the whole document (their modals teleport to body). Widgets share
    // the home page with each other, so each one only sees clicks inside itself.
    if (page && !instance?.proxy?.$el?.contains?.(e.target)) return
    const el = e.target.closest?.('[data-track], a[href]')
    if (!el) return
    if (el.dataset.track) {
      const [action, ...rest] = el.dataset.track.split(':')
      return trackUsage(action, rest.join(':'), page)
    }
    try {
      const url = new URL(el.href)
      if (/^https?:$/.test(url.protocol) && url.host !== window.location.host) {
        trackUsage('link', linkKind(url), page)
      }
    } catch { /* not a URL */ }
  }

  onMounted(() => {
    document.addEventListener('click', onClick, true)
    if (page) return trackUsage('view', undefined, page)
    const view = currentViewId()
    if (lastView && lastView !== view && Date.now() - lastViewLeftAt < 2000) {
      trackUsage('nav', `from-${lastView}`)
    }
    lastView = view
  })

  onBeforeUnmount(() => {
    document.removeEventListener('click', onClick, true)
    if (!page) lastViewLeftAt = Date.now()
  })
}
