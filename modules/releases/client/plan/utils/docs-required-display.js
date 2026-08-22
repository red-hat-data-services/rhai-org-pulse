/**
 * Docs Required column helpers for PM Hub.
 * Column shows the Jira Docs Required field; warn when Yes but Documentation
 * component is missing (same rule as FPDoR Docs impact).
 */

function normalizeComponentName(comp) {
  if (!comp) return ''
  if (typeof comp === 'string') return comp.trim()
  if (comp.name) return String(comp.name).trim()
  return String(comp).trim()
}

function hasDocumentationComponent(feature) {
  var comps = (feature && feature.components) || []
  if (!Array.isArray(comps)) return false
  for (var i = 0; i < comps.length; i++) {
    var name = normalizeComponentName(comps[i])
    if (name === 'Documentation' || name === 'Docs') return true
  }
  return false
}

/**
 * @returns {'yes' | 'yes-missing-component' | 'no' | 'unset'}
 */
function docsRequiredState(feature) {
  var raw = feature && feature.docsRequired
  if (raw == null || raw === '') return 'unset'
  var normalized = String(raw).trim()
  if (/^no$/i.test(normalized)) return 'no'
  if (/^yes$/i.test(normalized)) {
    return hasDocumentationComponent(feature) ? 'yes' : 'yes-missing-component'
  }
  return 'unset'
}

function docsRequiredLabel(feature) {
  switch (docsRequiredState(feature)) {
    case 'yes':
    case 'yes-missing-component':
      return 'Yes'
    case 'no':
      return 'No'
    default:
      return '—'
  }
}

function docsRequiredTitle(feature) {
  switch (docsRequiredState(feature)) {
    case 'yes':
      return 'Docs Required = Yes and Documentation component is set'
    case 'yes-missing-component':
      return 'Docs Required = Yes but Documentation component is missing — Docs impact fails until Documentation (or Docs) is added'
    case 'no':
      return 'Docs Required = No (Docs impact passes without Documentation component)'
    default:
      return 'Docs Required (Yes/No) not set — Docs impact fails until assessed'
  }
}

function docsRequiredChipClass(feature) {
  switch (docsRequiredState(feature)) {
    case 'yes':
      return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
    case 'yes-missing-component':
      return 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200'
    case 'no':
      return 'bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400'
    default:
      return 'bg-gray-100 dark:bg-gray-700/60 text-gray-400 dark:text-gray-500'
  }
}

export {
  hasDocumentationComponent,
  docsRequiredState,
  docsRequiredLabel,
  docsRequiredTitle,
  docsRequiredChipClass
}
