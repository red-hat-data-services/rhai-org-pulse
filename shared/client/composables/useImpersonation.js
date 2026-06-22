import { computed } from 'vue'
import { impersonatingUid, impersonatingName } from '@shared/client/state/impersonation'

export function useImpersonation() {
  function startImpersonating(uid, name, { refreshAuth, refreshPermissions } = {}) {
    impersonatingUid.value = uid
    impersonatingName.value = name
    if (refreshAuth) refreshAuth()
    if (refreshPermissions) refreshPermissions()
  }

  function stopImpersonating({ refreshAuth, refreshPermissions } = {}) {
    impersonatingUid.value = null
    impersonatingName.value = null
    if (refreshAuth) refreshAuth()
    if (refreshPermissions) refreshPermissions()
  }

  const isImpersonating = computed(() => !!impersonatingUid.value)

  return {
    impersonatingUid,
    impersonatingName,
    isImpersonating,
    startImpersonating,
    stopImpersonating
  }
}
