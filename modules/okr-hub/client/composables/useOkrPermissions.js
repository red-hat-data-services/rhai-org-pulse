import { computed } from 'vue'
import { useAuth } from '@shared/client/composables/useAuth'

var OKR_EDITORS = [
  'saprabhu@redhat.com',
  'trozell@redhat.com',
  'dodaniel@redhat.com',
  'shuels@redhat.com'
]

export function useOkrPermissions() {
  var { user, isAdmin } = useAuth()

  var canEdit = computed(function () {
    if (isAdmin.value) return true
    var u = user.value
    if (!u) return false
    if (u.authMethod === 'local-dev') return true
    var email = (u.email || '').toLowerCase()
    return OKR_EDITORS.indexOf(email) !== -1
  })

  return { canEdit }
}
