import { ref, watch, computed } from 'vue'
import { useAuth } from '@shared/client/composables/useAuth.js'
import { useRoster } from '@shared/client/composables/useRoster.js'
import { impersonatingUid, impersonatingName } from '@shared/client/state/impersonation.js'

const STORAGE_KEY = 'pm-pipeline.identity'

const pmDisplayName = ref('')
const viewAsPm = ref('')
const release = ref('3.5')
let storageLoaded = false

function loadStorage() {
  if (storageLoaded) return
  storageLoaded = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (data.pmDisplayName) pmDisplayName.value = data.pmDisplayName
      if (data.viewAsPm) viewAsPm.value = data.viewAsPm
      if (data.release) release.value = data.release
    }
  } catch {
    /* ignore */
  }
}

function saveStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    pmDisplayName: pmDisplayName.value,
    viewAsPm: viewAsPm.value,
    release: release.value
  }))
}

watch([pmDisplayName, viewAsPm, release], saveStorage)

function findPersonByUid(rosterData, uid) {
  if (!rosterData?.orgs) return null
  for (const org of rosterData.orgs) {
    if (!org.teams) continue
    for (const team of Object.values(org.teams)) {
      if (!team.members) continue
      for (const member of team.members) {
        if (member.uid === uid) return member
      }
    }
  }
  return null
}

function findPersonByJiraName(rosterData, name) {
  if (!rosterData?.orgs || !name) return null
  const target = name.trim().toLowerCase()
  for (const org of rosterData.orgs) {
    if (!org.teams) continue
    for (const team of Object.values(org.teams)) {
      if (!team.members) continue
      for (const member of team.members) {
        const jira = member.jiraDisplayName || member.name || ''
        if (jira.trim().toLowerCase() === target) return member
      }
    }
  }
  return null
}

/** Jira display name used for API queries (view-as overrides self). */
const effectivePmDisplayName = computed(() => {
  const viewAs = viewAsPm.value?.trim()
  if (viewAs) return viewAs
  return pmDisplayName.value?.trim() || ''
})

const isViewAsActive = computed(() => {
  const viewAs = viewAsPm.value?.trim()
  const self = pmDisplayName.value?.trim()
  return Boolean(viewAs && viewAs !== self)
})

export function usePmIdentity() {
  loadStorage()

  const { user, loading: authLoading } = useAuth()
  const { rosterData, loading: rosterLoading, loadRoster } = useRoster()

  loadRoster()

  const rosterResolvedName = computed(() => {
    const roster = rosterData.value
    if (!roster) return null

    if (impersonatingUid.value) {
      const person = findPersonByUid(roster, impersonatingUid.value)
      if (person?.jiraDisplayName) return person.jiraDisplayName
      if (person?.name) return person.name
    }

    if (user.value?.email) {
      const uid = user.value.email.split('@')[0]
      const person = findPersonByUid(roster, uid)
      if (person?.jiraDisplayName) return person.jiraDisplayName
      if (person?.name) return person.name
    }

    return null
  })

  watch([rosterResolvedName, authLoading, rosterLoading], () => {
    if (authLoading.value || rosterLoading.value) return
    const resolved = rosterResolvedName.value
    if (resolved && !pmDisplayName.value.trim()) {
      pmDisplayName.value = resolved
    }
  }, { immediate: true })

  function setIdentity(name, rel) {
    if (name !== undefined) pmDisplayName.value = name
    if (rel !== undefined) release.value = rel
  }

  function clearViewAs() {
    viewAsPm.value = ''
  }

  const impersonationLabel = computed(() => {
    if (impersonatingName.value) return impersonatingName.value
    if (impersonatingUid.value) return impersonatingUid.value
    return null
  })

  return {
    user,
    pmDisplayName,
    viewAsPm,
    effectivePmDisplayName,
    isViewAsActive,
    impersonationLabel,
    release,
    rosterResolvedName,
    setIdentity,
    clearViewAs,
    findPersonByJiraName: (name) => findPersonByJiraName(rosterData.value, name)
  }
}
