import { ref, nextTick } from 'vue'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import '../styles/manager-tutorial.css'

const STORAGE_KEY = 'tt_manager_tutorial_seen'
const PHASE_KEY = 'tt_manager_tutorial_phase'
const PHASE_TTL = 5 * 60 * 1000 // 5 minutes

const showTutorial = ref(false)
let activeDriver = null

export function useManagerTutorial() {

  // --- localStorage (permanent "seen" flag) ---

  function hasSeenTutorial() {
    try { return localStorage.getItem(STORAGE_KEY) === '1' }
    catch { return false }
  }

  function markSeen() {
    try { localStorage.setItem(STORAGE_KEY, '1') }
    catch { /* storage unavailable */ }
  }

  // --- sessionStorage (ephemeral phase state) ---

  function getActivePhase() {
    try {
      const raw = sessionStorage.getItem(PHASE_KEY)
      if (!raw) return null
      const phase = JSON.parse(raw)
      if (Date.now() - phase.ts > PHASE_TTL) {
        sessionStorage.removeItem(PHASE_KEY)
        return null
      }
      return phase
    } catch {
      sessionStorage.removeItem(PHASE_KEY)
      return null
    }
  }

  function setPhase(data) {
    try {
      sessionStorage.setItem(PHASE_KEY, JSON.stringify({ ...data, ts: Date.now() }))
    } catch { /* storage unavailable */ }
  }

  function clearPhase() {
    try { sessionStorage.removeItem(PHASE_KEY) }
    catch { /* ignore */ }
  }

  // --- Missing element pre-filter (Finding #1) ---

  function filterSteps(steps) {
    return steps.filter(step => {
      if (step._skipFilter) return true
      if (!step.element) return true
      return document.querySelector(step.element) !== null
    })
  }

  // --- DOM readiness ---

  function waitForElement(selector, timeoutMs = 5000) {
    return new Promise((resolve) => {
      const existing = document.querySelector(selector)
      if (existing) { resolve(existing); return }

      let resolved = false
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector)
        if (el && !resolved) {
          resolved = true
          observer.disconnect()
          resolve(el)
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })

      setTimeout(() => {
        if (!resolved) {
          resolved = true
          observer.disconnect()
          resolve(null)
        }
      }, timeoutMs)
    })
  }

  // --- Driver.js lifecycle ---

  function destroyTour() {
    if (activeDriver) {
      activeDriver.destroy()
      activeDriver = null
    }
    showTutorial.value = false
  }

  function createDriver(steps, { onComplete } = {}) {
    destroyTour()

    const filtered = filterSteps(steps)
    if (filtered.length === 0) {
      if (onComplete) onComplete()
      return
    }

    showTutorial.value = true

    activeDriver = driver({
      showProgress: false, // Suppressed: per-phase counters are confusing (Finding #4)
      animate: true,
      overlayColor: 'rgba(0, 0, 0, 0.6)',
      stagePadding: 8,
      stageRadius: 8,
      allowClose: true,
      popoverClass: 'tt-tour-popover',
      prevBtnText: 'Previous',
      nextBtnText: 'Next',
      doneBtnText: 'Done',
      onDestroyed: () => {
        showTutorial.value = false
        activeDriver = null
        if (onComplete) onComplete()
      },
      steps: filtered
    })

    activeDriver.drive()
  }

  // --- Phase 1 & 2: Dashboard steps ---

  function startDashboardTour(_options = {}) {
    // Steps 1-9: My Reports tab + interactive tab click + My Teams tab
    const reportsSteps = [
      {
        element: '[data-tour="dashboard-header"]',
        popover: {
          title: 'Welcome to My Teams',
          description: 'This dashboard shows your direct reports and their teams. '
            + 'You can edit fields, track completeness, and manage team data '
            + '-- all from one place.',
          side: 'bottom', align: 'start'
        }
      },
      {
        element: '[data-tour="indirect-toggle"]',
        popover: {
          title: 'Include Indirect Reports',
          description: 'Toggle this to expand the table to include people '
            + 'who report to your direct reports.',
          side: 'bottom', align: 'start'
        }
      },
      {
        element: '[data-tour="edit-all-btn"]',
        popover: {
          title: 'Bulk Editing',
          description: 'Click "Edit All Fields" to turn every editable column '
            + 'into an editor at once. An unsaved-changes counter shows how many '
            + 'fields you\'ve modified. Save or cancel when done.',
          side: 'bottom', align: 'start'
        }
      },
      {
        element: '[data-tour="search-reports"]',
        popover: {
          title: 'Search',
          description: 'Type a name, title, team, or field value to filter '
            + 'the table instantly.',
          side: 'bottom', align: 'start'
        }
      },
      {
        element: '[data-tour="field-cell"]',
        popover: {
          title: 'Inline Editing & Completeness',
          description: 'Click any field cell to edit it inline. Empty fields '
            + 'are highlighted in red. When fields are incomplete, an amber '
            + 'banner appears with a "Show incomplete only" filter.',
          side: 'bottom', align: 'start'
        }
      },
      // Step 6: Interactive tab click
      {
        element: '[data-tour="tab-teams"]',
        popover: {
          title: 'My Teams Tab',
          description: 'Click this tab to see your teams and their fields.',
          side: 'bottom', align: 'start',
          showButtons: ['close']
        },
        onHighlightStarted: () => {
          const tabEl = document.querySelector('[data-tour="tab-teams"]')
          if (tabEl) {
            tabEl.addEventListener('click', async () => {
              // Wait for the teams tab content to render (v-if swap)
              const tableEl = await waitForElement(
                '[data-tour="team-fields-table"]', 3000
              )
              if (!tableEl) {
                // Teams tab content did not render; end tour gracefully
                if (activeDriver) activeDriver.destroy()
                return
              }
              if (activeDriver) activeDriver.moveNext()
            }, { once: true })
          }
        }
      },
      // Steps 7-8: Teams tab content (marked _skipFilter since they don't exist yet)
      {
        element: '[data-tour="team-fields-table"]',
        popover: {
          title: 'Team Fields & Boards',
          description: 'Edit team-level custom fields the same way -- click '
            + 'any cell or use "Edit All Fields." Click a boards cell to open '
            + 'the boards drawer.',
          side: 'top', align: 'start'
        },
        _skipFilter: true
      },
      {
        element: '[data-tour="team-fields-table"]',
        popover: {
          title: 'Visit a Team',
          description: 'Now let\'s visit a team detail page to see full team '
            + 'information with all fields and members.',
          side: 'top', align: 'start'
        },
        _skipFilter: true
      },
      // Step 9: Interactive team link click (cross-page)
      {
        element: '[data-tour="first-team-link"]',
        popover: {
          title: 'Visit Team Detail',
          description: 'Click this team to see its full detail page.',
          side: 'bottom', align: 'start',
          showButtons: ['close']
        },
        _skipFilter: true,
        onHighlightStarted: () => {
          const el = document.querySelector('[data-tour="first-team-link"]')
          if (el) {
            el.addEventListener('click', () => {
              const teamKey = el.getAttribute('data-tour-team-key')
              setPhase({ phase: 'team-detail', teamKey })
              // Navigation happens via the element's own @click handler
            }, { once: true })
          }
        }
      }
    ]

    // Custom filter that respects _skipFilter
    const filtered = reportsSteps.filter(step => {
      if (step._skipFilter) return true
      if (!step.element) return true
      return document.querySelector(step.element) !== null
    })

    if (filtered.length === 0) return

    destroyTour()
    showTutorial.value = true

    activeDriver = driver({
      showProgress: false,
      animate: true,
      overlayColor: 'rgba(0, 0, 0, 0.6)',
      stagePadding: 8,
      stageRadius: 8,
      allowClose: true,
      popoverClass: 'tt-tour-popover',
      prevBtnText: 'Previous',
      nextBtnText: 'Next',
      doneBtnText: 'Done',
      onDestroyed: () => {
        showTutorial.value = false
        activeDriver = null
        // If tour was destroyed without cross-page phase, mark as seen
        if (!getActivePhase()) {
          markSeen()
        }
      },
      steps: filtered
    })

    activeDriver.drive()
  }

  // --- Phase 3: Team Detail steps ---

  async function startTeamDetailTour() {
    // Wait for the primary target; fall back to member link if TeamFieldEditor
    // is not rendered (no visible team fields)
    const primaryEl = await waitForElement('[data-tour="team-field-editor"]', 8000)
    const memberEl = primaryEl
      ? document.querySelector('[data-tour="first-member-link"]')
      : await waitForElement('[data-tour="first-member-link"]', 3000)

    if (!primaryEl && !memberEl) {
      // Nothing to highlight on this page
      clearPhase()
      markSeen()
      return
    }

    const steps = [
      {
        element: '[data-tour="team-field-editor"]',
        popover: {
          title: 'Team Detail Fields',
          description: 'This is the full team detail view. Team-level custom fields '
            + 'appear here and can be edited just like on the dashboard.',
          side: 'bottom', align: 'start',
          showButtons: ['next', 'close']
        }
      },
      {
        element: '[data-tour="first-member-link"]',
        popover: {
          title: 'Team Members',
          description: 'Click a team member to view their profile and edit person-level fields.',
          side: 'bottom', align: 'start',
          showButtons: ['close']
        },
        onHighlightStarted: () => {
          const el = document.querySelector('[data-tour="first-member-link"]')
          if (el) {
            el.addEventListener('click', (e) => {
              // el is an <a> tag with @click.stop (Finding #2)
              e.preventDefault()
              e.stopPropagation()
              const uid = el.getAttribute('data-tour-person-uid')
              setPhase({ phase: 'person-detail', personUid: uid })
              // Navigate via the <a> href that linkTo() already computed
              window.location.hash = new URL(el.href).hash
            }, { once: true })
          }
        }
      }
    ]

    createDriver(steps, {
      onComplete: () => {
        if (!getActivePhase()) {
          markSeen()
          clearPhase()
        }
      }
    })
  }

  // --- Phase 4: Person Detail steps ---

  async function startPersonDetailTour() {
    // Person profile card should always exist; person-field-editor may not
    const profileEl = await waitForElement('[data-tour="person-profile-card"]', 8000)
    if (!profileEl) {
      clearPhase()
      markSeen()
      return
    }

    const steps = [
      {
        element: '[data-tour="person-field-editor"]',
        popover: {
          title: 'Person Fields',
          description: 'Custom fields for this person appear here. Click the pencil '
            + 'icon to edit any field. These are the same fields shown in the '
            + 'dashboard table.',
          side: 'bottom', align: 'start',
          showButtons: ['next', 'close']
        }
      },
      {
        element: '[data-tour="person-profile-card"]',
        popover: {
          title: 'You\'re All Set!',
          description: 'Navigate back to My Teams using the sidebar. Use the help '
            + 'button (?) anytime to replay this tour.',
          side: 'bottom', align: 'start',
          showButtons: ['previous', 'next'],
          nextBtnText: 'Finish'
        }
      }
    ]

    createDriver(steps, {
      onComplete: () => {
        markSeen()
        clearPhase()
      }
    })
  }

  // --- Public API ---

  function launchTutorial(options = {}) {
    clearPhase()
    if (options.onTabClick) options.onTabClick('reports')
    nextTick(() => startDashboardTour(options))
  }

  function checkFirstVisit(options = {}) {
    if (!hasSeenTutorial()) {
      launchTutorial(options)
    }
  }

  /**
   * Called by TeamRosterView and PersonProfileView on mount.
   * Checks sessionStorage for an active tour phase matching the given view.
   * If found, starts the phase-specific Driver.js tour after DOM readiness.
   */
  function resumeTourIfActive(viewId) {
    const phase = getActivePhase()
    if (!phase) return

    if (viewId === 'team-detail' && phase.phase === 'team-detail') {
      startTeamDetailTour()
    } else if (viewId === 'person-detail' && phase.phase === 'person-detail') {
      startPersonDetailTour()
    }
  }

  return {
    showTutorial,
    launchTutorial,
    destroyTour,
    checkFirstVisit,
    resumeTourIfActive
  }
}
