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
      name: 'AI Engineering OKRs',
      objectives: [
        {
          id: 'on-time-releases',
          name: 'On Time Releases',
          measure: 'Number of Releases On Time - 100%',
          quarters: { Q1: emptyQuarter(), Q2: emptyQuarter(), Q3: emptyQuarter(), Q4: emptyQuarter() },
          keyResults: [
            { id: 'kr-otr-1', label: 'KR1', description: 'Number of releases on time — 100%', status: 'not-started' }
          ]
        },
        {
          id: 'cve-sla',
          name: 'CVE SLA Compliance',
          measure: 'Number of Escalations and On Time Response - 100%',
          quarters: { Q1: emptyQuarter(), Q2: emptyQuarter(), Q3: emptyQuarter(), Q4: emptyQuarter() },
          keyResults: [
            { id: 'kr-cve-1', label: 'KR1', description: 'Number of escalations and on time response — 100%', status: 'not-started' }
          ]
        },
        {
          id: 'support-cases',
          name: 'Support Case Time to Resolution',
          measure: 'Defect Rate for Product: 10% | Time to Resolution Target: 10-14 days',
          quarters: { Q1: emptyQuarter(), Q2: emptyQuarter(), Q3: emptyQuarter(), Q4: emptyQuarter() },
          keyResults: [
            { id: 'kr-sc-1', label: 'KR1', description: 'Defect rate for product: 10%', status: 'not-started' },
            { id: 'kr-sc-2', label: 'KR2', description: 'Time to resolution target: 10-14 days', status: 'not-started' }
          ]
        },
        {
          id: 'open-source-leadership',
          name: 'Open Source Leadership',
          measure: 'RH wants to be the open source leader in AI - Investment areas identified.',
          quarters: { Q1: emptyQuarter(), Q2: emptyQuarter(), Q3: emptyQuarter(), Q4: emptyQuarter() },
          keyResults: [
            { id: 'kr-osl-1', label: 'KR1', description: 'Upstream contributions and community engagement targets', status: 'not-started' }
          ]
        },
        {
          id: 'associate-well-being',
          name: 'Associate Well Being',
          measure: 'Implement programs that supports employee balance & engagement.',
          quarters: { Q1: emptyQuarter(), Q2: emptyQuarter(), Q3: emptyQuarter(), Q4: emptyQuarter() },
          keyResults: [
            { id: 'kr-awb-1', label: 'KR1', description: 'Associate satisfaction and well-being targets', status: 'not-started' }
          ]
        },
        {
          id: 'improve-quality-usability',
          name: 'Improve Quality and Usability',
          measure: '',
          quarters: { Q1: emptyQuarter(), Q2: emptyQuarter(), Q3: emptyQuarter(), Q4: emptyQuarter() },
          keyResults: [
            { id: 'kr-iqu-1', label: 'KR1', description: '90% reduction in bugs (Functional, UX, Regressions) discovered post-release by the field', quarters: { Q1: emptyQuarter(), Q2: emptyQuarter(), Q3: emptyQuarter(), Q4: emptyQuarter() } },
            { id: 'kr-iqu-2', label: 'KR2', description: '>90% of planned features for a release are delivered in the target release', quarters: { Q1: emptyQuarter(), Q2: emptyQuarter(), Q3: emptyQuarter(), Q4: emptyQuarter() } }
          ]
        },
        {
          id: 'adoption-of-ai',
          name: 'Adoption of AI',
          measure: '100% of AI Eng teams using RFE Builder/Ambient Platform as part of the daily release process',
          quarters: { Q1: emptyQuarter(), Q2: emptyQuarter(), Q3: emptyQuarter(), Q4: emptyQuarter() },
          keyResults: [
            { id: 'kr-aai-1', label: 'KR1', description: '100% of AI Eng teams using RFE Builder/Ambient Platform as part of the daily release process', status: 'not-started' }
          ]
        },
        {
          id: 'tech-visibility',
          name: 'Increase Red Hat AI technical visibility across internal and external sources',
          measure: '',
          quarters: { Q1: emptyQuarter(), Q2: emptyQuarter(), Q3: emptyQuarter(), Q4: emptyQuarter() },
          keyResults: [
            { id: 'kr-tv-1', label: 'KR1', description: '>5 posts per week to rh-ai-sme@redhat.com', quarters: { Q1: emptyQuarter(), Q2: emptyQuarter(), Q3: emptyQuarter(), Q4: emptyQuarter() } },
            { id: 'kr-tv-2', label: 'KR2', description: '1 piece of content from each AI Eng associate for internal or external consumption (ie, blog, feature demo, tutorial) for the year', quarters: { Q1: emptyQuarter(), Q2: emptyQuarter(), Q3: emptyQuarter(), Q4: emptyQuarter() } }
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
