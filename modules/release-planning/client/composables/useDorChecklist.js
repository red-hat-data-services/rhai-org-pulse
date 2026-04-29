import { ref } from 'vue'
import { useReleaseHealth } from './useReleaseHealth'

/**
 * Manages local DoR checklist toggle state with debounced save.
 *
 * Each feature's manual checks are buffered locally and flushed
 * to the server after 250ms of inactivity, batching rapid toggles
 * into a single PUT request.
 */
export function useDorChecklist() {
  var { updateDorItem } = useReleaseHealth()
  var pendingUpdates = ref({})
  var saving = ref(false)
  var saveError = ref(null)
  var debounceTimers = {}

  /**
   * Toggle a manual DoR item and schedule a debounced save.
   *
   * @param {string} version - Release version
   * @param {string} featureKey - Jira feature key
   * @param {string} itemId - DoR item ID (e.g. 'F-3')
   * @param {boolean} checked - New checked state
   * @param {string} [notes] - Optional notes text
   */
  function toggleItem(version, featureKey, itemId, checked, notes) {
    var key = version + ':' + featureKey

    if (!pendingUpdates.value[key]) {
      pendingUpdates.value[key] = { items: {}, notes: undefined }
    }
    pendingUpdates.value[key].items[itemId] = checked
    if (notes !== undefined) {
      pendingUpdates.value[key].notes = notes
    }

    // Clear any existing timer for this feature
    if (debounceTimers[key]) {
      clearTimeout(debounceTimers[key])
    }

    // Set new debounced save
    debounceTimers[key] = setTimeout(function() {
      flush(version, featureKey)
    }, 250)
  }

  /**
   * Save notes for a feature with debounced save.
   */
  function updateNotes(version, featureKey, notes) {
    var key = version + ':' + featureKey

    if (!pendingUpdates.value[key]) {
      pendingUpdates.value[key] = { items: {}, notes: undefined }
    }
    pendingUpdates.value[key].notes = notes

    if (debounceTimers[key]) {
      clearTimeout(debounceTimers[key])
    }

    debounceTimers[key] = setTimeout(function() {
      flush(version, featureKey)
    }, 250)
  }

  /**
   * Flush pending updates for a specific feature.
   */
  async function flush(version, featureKey) {
    var key = version + ':' + featureKey
    var pending = pendingUpdates.value[key]
    if (!pending) return

    // Clear pending before sending so new toggles during save start a fresh batch
    delete pendingUpdates.value[key]
    pendingUpdates.value = Object.assign({}, pendingUpdates.value)

    // Only send if there are actual items or notes to update
    var hasItems = Object.keys(pending.items).length > 0
    var hasNotes = pending.notes !== undefined
    if (!hasItems && !hasNotes) return

    saving.value = true
    saveError.value = null

    try {
      var result = await updateDorItem(
        version,
        featureKey,
        hasItems ? pending.items : {},
        pending.notes
      )
      return result
    } catch (err) {
      saveError.value = err.message
      throw err
    } finally {
      saving.value = false
    }
  }

  /**
   * Cancel all pending debounced saves.
   */
  function cancelAll() {
    var keys = Object.keys(debounceTimers)
    for (var i = 0; i < keys.length; i++) {
      clearTimeout(debounceTimers[keys[i]])
      delete debounceTimers[keys[i]]
    }
    pendingUpdates.value = {}
  }

  return {
    pendingUpdates: pendingUpdates,
    saving: saving,
    saveError: saveError,
    toggleItem: toggleItem,
    updateNotes: updateNotes,
    flush: flush,
    cancelAll: cancelAll
  }
}
