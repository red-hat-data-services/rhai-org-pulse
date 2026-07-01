export var QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']

export var STATUS_CONFIG = {
  green: {
    label: 'On Track',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500'
  },
  yellow: {
    label: 'Partial',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    text: 'text-yellow-700 dark:text-yellow-300',
    dot: 'bg-yellow-500'
  },
  red: {
    label: 'At Risk',
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500'
  },
  'not-started': {
    label: 'Not Started',
    bg: 'bg-gray-50 dark:bg-gray-800/30',
    text: 'text-gray-500 dark:text-gray-400',
    dot: 'bg-gray-400'
  }
}

function emptyQuarter() {
  return { status: 'not-started', summary: '' }
}

export var OKR_DATA = {
  year: 2026,
  categories: [
    {
      name: 'Quality & Reliability',
      objectives: [
        {
          id: 'on-time-releases',
          name: 'On Time Releases',
          measure: '100% of releases hit planned GA date',
          quarters: { Q1: emptyQuarter(), Q2: emptyQuarter(), Q3: emptyQuarter(), Q4: emptyQuarter() },
          keyResults: [
            { id: 'kr-otr-1', label: 'KR1', description: 'Number of releases on time — 100%', status: 'not-started' }
          ]
        },
        {
          id: 'cve-sla',
          name: 'CVE SLA Compliance',
          measure: '100% on-time escalation response',
          quarters: { Q1: emptyQuarter(), Q2: emptyQuarter(), Q3: emptyQuarter(), Q4: emptyQuarter() },
          keyResults: [
            { id: 'kr-cve-1', label: 'KR1', description: 'Number of escalations and on time response — 100%', status: 'not-started' }
          ]
        },
        {
          id: 'post-release-defects',
          name: 'Post-Release Defects',
          measure: '90% reduction in bugs discovered post-release',
          quarters: { Q1: emptyQuarter(), Q2: emptyQuarter(), Q3: emptyQuarter(), Q4: emptyQuarter() },
          keyResults: [
            { id: 'kr-prd-1', label: 'KR1', description: '90% reduction in functional, UX, and regression bugs found post-release by the field', status: 'not-started' }
          ]
        }
      ]
    },
    {
      name: 'Delivery Predictability',
      objectives: [
        {
          id: 'commitment-tracking',
          name: 'Commitment Tracking',
          measure: '>90% of planned features delivered in target release',
          quarters: { Q1: emptyQuarter(), Q2: emptyQuarter(), Q3: emptyQuarter(), Q4: emptyQuarter() },
          keyResults: [
            { id: 'kr-ct-1', label: 'KR1', description: '>90% of planned features for a release are delivered in the target release', status: 'not-started' }
          ]
        }
      ]
    },
    {
      name: 'Technical Visibility',
      objectives: [
        {
          id: 'tech-visibility',
          name: 'Technical Visibility',
          measure: '>5 posts/week and 1 content per associate',
          quarters: { Q1: emptyQuarter(), Q2: emptyQuarter(), Q3: emptyQuarter(), Q4: emptyQuarter() },
          keyResults: [
            { id: 'kr-tv-1', label: 'KR1', description: '>= 5 posts per week across internal and external sources', status: 'not-started' },
            { id: 'kr-tv-2', label: 'KR2', description: '1 piece of content from each AI Eng associate', status: 'not-started' }
          ]
        }
      ]
    },
    {
      name: 'Support & Customer Success',
      objectives: [
        {
          id: 'support-cases',
          name: 'Support Case Time To Resolution',
          measure: 'Defect rate <= 10%, resolution target 10-14 days',
          quarters: { Q1: emptyQuarter(), Q2: emptyQuarter(), Q3: emptyQuarter(), Q4: emptyQuarter() },
          keyResults: [
            { id: 'kr-sc-1', label: 'KR1', description: 'Defect rate for product: 10%', status: 'not-started' },
            { id: 'kr-sc-2', label: 'KR2', description: 'Time to resolution target: 10-14 days', status: 'not-started' }
          ]
        }
      ]
    }
  ]
}

export function findObjectiveById(id) {
  for (var ci = 0; ci < OKR_DATA.categories.length; ci++) {
    var cat = OKR_DATA.categories[ci]
    for (var oi = 0; oi < cat.objectives.length; oi++) {
      if (cat.objectives[oi].id === id) {
        return { category: cat.name, objective: cat.objectives[oi] }
      }
    }
  }
  return null
}
