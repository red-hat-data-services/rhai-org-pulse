/**
 * Build RFE markdown content following pm-toolkit template structure
 */

/**
 * Build RFE description in markdown format following the standard template
 */
function buildRfeDescription(rfeData) {
  const {
    businessJustification,
    technicalDetails,
    useCases,
    customerCompany,
    industryVertical,
    arrImpact,
    priority,
    sourceInteractionId
  } = rfeData

  const sections = []

  // Summary (required)
  sections.push('## Summary')
  sections.push(businessJustification)
  sections.push('')

  // Problem Statement (required)
  sections.push('## Problem Statement')
  sections.push(technicalDetails)
  sections.push('')

  // Use Cases (if provided)
  if (useCases) {
    sections.push('## User Scenarios')
    sections.push(useCases)
    sections.push('')
  }

  // Business Alignment
  sections.push('## Business Alignment')
  sections.push('**Business Value and Impact:**')
  if (customerCompany) {
    sections.push(`- **Customer(s):** ${customerCompany}`)
  }
  if (industryVertical) {
    sections.push(`- **Industry Vertical:** ${industryVertical}`)
  }
  if (arrImpact) {
    sections.push(`- **Estimated ARR Impact:** $${arrImpact.toLocaleString()}`)
  }
  if (priority) {
    sections.push(`- **Priority:** ${priority}`)
  }
  sections.push('')

  // Affected Customers
  if (customerCompany || industryVertical) {
    sections.push('## Affected Customers/Partners & Scope')
    if (customerCompany) {
      sections.push(`**Customers:** ${customerCompany}`)
      sections.push('')
    }
    if (industryVertical) {
      sections.push(`**Industry Focus:** ${industryVertical}`)
      sections.push('')
    }
  }

  // Acceptance Criteria placeholder
  sections.push('## Acceptance Criteria')
  sections.push('- [ ] Feature implemented and tested')
  sections.push('- [ ] Documentation updated')
  sections.push('- [ ] Customer validation completed')
  sections.push('')

  // Reference back to source interaction
  if (sourceInteractionId) {
    sections.push('## Reference Documents/Links')
    sections.push(`- Source Customer Interaction: ${sourceInteractionId}`)
    sections.push('- Customer feedback captured in Org Pulse Customer Insights module')
    sections.push('')
  }

  // Metadata footer
  sections.push('---')
  sections.push('*Created via Org Pulse Customer Insights RFE Creator*')

  return sections.join('\n')
}

/**
 * Build Jira issue fields object
 */
function buildJiraIssueFields(rfeData, projectKey = 'RHAIRFE') {
  const {
    component,
    title,
    priority = 'Medium'
  } = rfeData

  const description = buildRfeDescription(rfeData)

  // Map priority to Jira values
  const priorityMap = {
    'Critical': 'Highest',
    'High': 'High',
    'Medium': 'Medium',
    'Low': 'Low'
  }

  const fields = {
    project: { key: projectKey },
    summary: title,
    description: description,
    issuetype: { name: 'Feature Request' },
    priority: { name: priorityMap[priority] || 'Medium' }
  }

  // Add labels
  const labels = ['rfe-creator-auto-created', 'customer-insights']
  if (component) {
    labels.push(component.toLowerCase().replace(/\s+/g, '-'))
  }
  fields.labels = labels

  return fields
}

module.exports = {
  buildRfeDescription,
  buildJiraIssueFields
}
