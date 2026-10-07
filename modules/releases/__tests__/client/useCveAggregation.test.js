import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useCveAggregation } from '../../client/reports/composables/useCveAggregation.js'

describe('useCveAggregation Jira links', () => {
  it('includes the RHAI project in generated external JQL links', () => {
    const aggregation = useCveAggregation(
      ref([{
        component: 'Model Serving',
        components: ['Model Serving'],
        versions: ['rhoai-3.4'],
        status: 'In Progress',
        assignee: 'Unassigned',
        duedate: null
      }]),
      ref('https://jira.example/issues/?jql='),
      ref({})
    )

    expect(decodeURIComponent(aggregation.totalOpen_jql.value)).toContain(
      'project in (RHAI, RHAIENG, RHOAIENG, INFERENG, AIPCC)'
    )
    expect(decodeURIComponent(aggregation.openCvesByComponent.value[0].jql)).toContain(
      'project in (RHAI, RHAIENG, RHOAIENG, INFERENG, AIPCC)'
    )
  })
})
