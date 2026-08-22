/**
 * Resolve link refs from resources catalog.
 * @param {object} resources - { id, label, url, category, phase, description }[]
 * @param {string[]} refs - resource IDs
 */
export function resolveLinks(resources, refs) {
  const byId = new Map(resources.map(r => [r.id, r]))
  return (refs || [])
    .map(ref => {
      const id = typeof ref === 'string' ? ref : ref.ref
      const resource = byId.get(id)
      if (!resource) return null
      return {
        id: resource.id,
        label: ref.label || resource.label,
        url: resource.url,
        category: resource.category,
        description: resource.description || null
      }
    })
    .filter(Boolean)
}

/**
 * Resolve playbook with embedded links.
 */
export function resolvePlaybook(playbooks, resources, section) {
  const playbook = playbooks.find(p => p.section === section)
  if (!playbook) return null

  return {
    section: playbook.section,
    title: playbook.title,
    owner: playbook.owner,
    symptom: playbook.symptom,
    steps: playbook.steps,
    links: resolveLinks(resources, playbook.links || []),
    stepLinks: (playbook.stepLinks || []).map(stepRefs => resolveLinks(resources, stepRefs)),
    jqlTemplate: playbook.jqlTemplate || null
  }
}

/**
 * Default context links for a pipeline phase.
 */
export function phaseContextLinks(resources, phase) {
  return resources.filter(r => r.phase === phase || r.phase === 0)
}
