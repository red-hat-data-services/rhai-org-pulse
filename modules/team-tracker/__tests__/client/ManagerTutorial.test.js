import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'

// Mock driver.js
const mockDrive = vi.fn()
const mockDestroy = vi.fn()
const mockMoveNext = vi.fn()
let capturedDriverConfig = null

vi.mock('driver.js', () => ({
  driver: (config) => {
    capturedDriverConfig = config
    return {
      drive: mockDrive,
      destroy: () => {
        mockDestroy()
        if (capturedDriverConfig?.onDestroyed) capturedDriverConfig.onDestroyed()
      },
      moveNext: mockMoveNext
    }
  }
}))

// Mock CSS imports
vi.mock('driver.js/dist/driver.css', () => ({}))
vi.mock('../../client/styles/manager-tutorial.css', () => ({}))

// Import after mocks
const { useManagerTutorial } = await import('../../client/composables/useManagerTutorial.js')

describe('useManagerTutorial', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    mockDrive.mockClear()
    mockDestroy.mockClear()
    mockMoveNext.mockClear()
    capturedDriverConfig = null
    // Reset any existing active driver
    const { destroyTour } = useManagerTutorial()
    destroyTour()
  })

  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  // --- localStorage "seen" flag tests ---

  describe('checkFirstVisit', () => {
    it('launches tour when localStorage is empty', async () => {
      const el = document.createElement('div')
      el.setAttribute('data-tour', 'dashboard-header')
      document.body.appendChild(el)

      const { checkFirstVisit } = useManagerTutorial()
      checkFirstVisit({ onTabClick: vi.fn(), nav: {} })
      await nextTick()

      expect(mockDrive).toHaveBeenCalled()
      document.body.removeChild(el)
    })

    it('does NOT launch tour when localStorage has "1"', async () => {
      localStorage.setItem('tt_manager_tutorial_seen', '1')
      const { checkFirstVisit } = useManagerTutorial()

      checkFirstVisit({ onTabClick: vi.fn(), nav: {} })
      await nextTick()

      expect(mockDrive).not.toHaveBeenCalled()
    })
  })

  // --- launchTutorial ---

  describe('launchTutorial', () => {
    it('resets to reports tab via onTabClick', () => {
      const onTabClick = vi.fn()
      const el = document.createElement('div')
      el.setAttribute('data-tour', 'dashboard-header')
      document.body.appendChild(el)

      const { launchTutorial } = useManagerTutorial()
      launchTutorial({ onTabClick, nav: {} })

      expect(onTabClick).toHaveBeenCalledWith('reports')
      document.body.removeChild(el)
    })

    it('clears any existing phase', () => {
      sessionStorage.setItem('tt_manager_tutorial_phase', JSON.stringify({
        phase: 'team-detail', ts: Date.now()
      }))
      const el = document.createElement('div')
      el.setAttribute('data-tour', 'dashboard-header')
      document.body.appendChild(el)

      const { launchTutorial } = useManagerTutorial()
      launchTutorial({ onTabClick: vi.fn(), nav: {} })

      expect(sessionStorage.getItem('tt_manager_tutorial_phase')).toBeNull()
      document.body.removeChild(el)
    })

    it('creates Driver.js with showProgress: false', async () => {
      const el = document.createElement('div')
      el.setAttribute('data-tour', 'dashboard-header')
      document.body.appendChild(el)

      const { launchTutorial } = useManagerTutorial()
      launchTutorial({ onTabClick: vi.fn(), nav: {} })
      await nextTick()

      expect(capturedDriverConfig).toBeTruthy()
      expect(capturedDriverConfig.showProgress).toBe(false)
      document.body.removeChild(el)
    })
  })

  // --- destroyTour ---

  describe('destroyTour', () => {
    it('cleans up Driver.js instance', async () => {
      const el = document.createElement('div')
      el.setAttribute('data-tour', 'dashboard-header')
      document.body.appendChild(el)

      const { launchTutorial, destroyTour } = useManagerTutorial()
      launchTutorial({ onTabClick: vi.fn(), nav: {} })
      await nextTick()

      destroyTour()
      expect(mockDestroy).toHaveBeenCalled()
      document.body.removeChild(el)
    })

    it('sets showTutorial to false', async () => {
      const el = document.createElement('div')
      el.setAttribute('data-tour', 'dashboard-header')
      document.body.appendChild(el)

      const { launchTutorial, destroyTour, showTutorial } = useManagerTutorial()
      launchTutorial({ onTabClick: vi.fn(), nav: {} })
      await nextTick()

      expect(showTutorial.value).toBe(true)
      destroyTour()
      expect(showTutorial.value).toBe(false)
      document.body.removeChild(el)
    })
  })

  // --- sessionStorage phase machine ---

  describe('phase machine', () => {
    it('resumeTourIfActive does nothing when sessionStorage is empty', () => {
      const { resumeTourIfActive } = useManagerTutorial()
      resumeTourIfActive('team-detail')
      expect(mockDrive).not.toHaveBeenCalled()
    })

    it('stale phase (>5 minutes) is cleared and ignored', () => {
      sessionStorage.setItem('tt_manager_tutorial_phase', JSON.stringify({
        phase: 'team-detail',
        ts: Date.now() - 6 * 60 * 1000
      }))

      const { resumeTourIfActive } = useManagerTutorial()
      resumeTourIfActive('team-detail')

      expect(mockDrive).not.toHaveBeenCalled()
      expect(sessionStorage.getItem('tt_manager_tutorial_phase')).toBeNull()
    })

    it('invalid JSON in phase is cleared and ignored', () => {
      sessionStorage.setItem('tt_manager_tutorial_phase', 'not-json')

      const { resumeTourIfActive } = useManagerTutorial()
      resumeTourIfActive('team-detail')

      expect(mockDrive).not.toHaveBeenCalled()
      expect(sessionStorage.getItem('tt_manager_tutorial_phase')).toBeNull()
    })
  })

  // --- resumeTourIfActive ---

  describe('resumeTourIfActive', () => {
    it('matches team-detail view correctly', async () => {
      sessionStorage.setItem('tt_manager_tutorial_phase', JSON.stringify({
        phase: 'team-detail',
        teamKey: 'org::Team',
        ts: Date.now()
      }))

      const el = document.createElement('div')
      el.setAttribute('data-tour', 'team-field-editor')
      document.body.appendChild(el)

      const { resumeTourIfActive } = useManagerTutorial()
      resumeTourIfActive('team-detail')

      // waitForElement is async
      await new Promise(r => setTimeout(r, 100))

      expect(mockDrive).toHaveBeenCalled()
      document.body.removeChild(el)
    })

    it('matches person-detail view correctly', async () => {
      sessionStorage.setItem('tt_manager_tutorial_phase', JSON.stringify({
        phase: 'person-detail',
        personUid: 'jsmith',
        ts: Date.now()
      }))

      const el = document.createElement('div')
      el.setAttribute('data-tour', 'person-profile-card')
      document.body.appendChild(el)

      const { resumeTourIfActive } = useManagerTutorial()
      resumeTourIfActive('person-detail')

      await new Promise(r => setTimeout(r, 100))

      expect(mockDrive).toHaveBeenCalled()
      document.body.removeChild(el)
    })

    it('does nothing when view does not match phase', () => {
      sessionStorage.setItem('tt_manager_tutorial_phase', JSON.stringify({
        phase: 'team-detail',
        ts: Date.now()
      }))

      const { resumeTourIfActive } = useManagerTutorial()
      resumeTourIfActive('person-detail')

      expect(mockDrive).not.toHaveBeenCalled()
    })

    it('does nothing when no phase is active', () => {
      const { resumeTourIfActive } = useManagerTutorial()
      resumeTourIfActive('team-detail')
      expect(mockDrive).not.toHaveBeenCalled()
    })
  })

  // --- filterSteps ---

  describe('filterSteps', () => {
    it('removes steps with missing elements', async () => {
      const el = document.createElement('div')
      el.setAttribute('data-tour', 'dashboard-header')
      document.body.appendChild(el)

      const { launchTutorial } = useManagerTutorial()
      launchTutorial({ onTabClick: vi.fn(), nav: {} })
      await nextTick()

      expect(capturedDriverConfig).toBeTruthy()
      const steps = capturedDriverConfig.steps
      expect(steps.some(s => s.element === '[data-tour="dashboard-header"]')).toBe(true)
      // indirect-toggle does not exist, filtered out
      expect(steps.some(s => s.element === '[data-tour="indirect-toggle"]')).toBe(false)

      document.body.removeChild(el)
    })

    it('preserves steps with _skipFilter: true', async () => {
      const el = document.createElement('div')
      el.setAttribute('data-tour', 'dashboard-header')
      document.body.appendChild(el)

      const { launchTutorial } = useManagerTutorial()
      launchTutorial({ onTabClick: vi.fn(), nav: {} })
      await nextTick()

      const steps = capturedDriverConfig.steps
      const skipFilterSteps = steps.filter(s => s._skipFilter)
      expect(skipFilterSteps.length).toBeGreaterThan(0)
      // These are the teams-tab steps that don't exist at tour start time
      expect(skipFilterSteps.some(s => s.element === '[data-tour="team-fields-table"]')).toBe(true)

      document.body.removeChild(el)
    })
  })

  // --- markSeen on completion ---

  describe('markSeen behavior', () => {
    it('marks seen when dashboard tour completes without cross-page phase', async () => {
      const el = document.createElement('div')
      el.setAttribute('data-tour', 'dashboard-header')
      document.body.appendChild(el)

      const { launchTutorial, destroyTour } = useManagerTutorial()
      launchTutorial({ onTabClick: vi.fn(), nav: {} })
      await nextTick()

      destroyTour()

      expect(localStorage.getItem('tt_manager_tutorial_seen')).toBe('1')
      document.body.removeChild(el)
    })

    it('does NOT mark seen when cross-page phase is active', async () => {
      const el = document.createElement('div')
      el.setAttribute('data-tour', 'dashboard-header')
      document.body.appendChild(el)

      const { launchTutorial } = useManagerTutorial()
      launchTutorial({ onTabClick: vi.fn(), nav: {} })
      await nextTick()

      // Simulate setting a phase before destroy (like team link click)
      sessionStorage.setItem('tt_manager_tutorial_phase', JSON.stringify({
        phase: 'team-detail', ts: Date.now()
      }))

      // Simulate the onDestroyed callback
      if (capturedDriverConfig?.onDestroyed) {
        capturedDriverConfig.onDestroyed()
      }

      // Should NOT mark seen since a phase is active
      expect(localStorage.getItem('tt_manager_tutorial_seen')).toBeNull()
      document.body.removeChild(el)
    })
  })

  // --- showTutorial singleton ---

  describe('showTutorial ref', () => {
    it('is shared across multiple composable calls', () => {
      const a = useManagerTutorial()
      const b = useManagerTutorial()
      a.showTutorial.value = true
      expect(b.showTutorial.value).toBe(true)
      a.showTutorial.value = false
    })
  })

  // --- Error handling ---

  describe('error handling', () => {
    it('handles localStorage errors gracefully in checkFirstVisit', () => {
      const originalGetItem = localStorage.getItem.bind(localStorage)
      localStorage.getItem = () => { throw new Error('Storage disabled') }

      const { checkFirstVisit } = useManagerTutorial()
      expect(() => checkFirstVisit({ onTabClick: vi.fn(), nav: {} })).not.toThrow()

      localStorage.getItem = originalGetItem
    })

    it('handles sessionStorage errors gracefully in resumeTourIfActive', () => {
      const originalGetItem = sessionStorage.getItem.bind(sessionStorage)
      sessionStorage.getItem = () => { throw new Error('Storage disabled') }

      const { resumeTourIfActive } = useManagerTutorial()
      expect(() => resumeTourIfActive('team-detail')).not.toThrow()

      sessionStorage.getItem = originalGetItem
    })
  })
})
