import { watch, nextTick } from 'vue'

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(containerRef, isOpen, onClose) {
  let previouslyFocused = null

  function getFocusable() {
    if (!containerRef.value) return []
    return Array.from(containerRef.value.querySelectorAll(FOCUSABLE))
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    const focusable = getFocusable()
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  watch(isOpen, function(open) {
    if (open) {
      previouslyFocused = document.activeElement
      nextTick(function() {
        const focusable = getFocusable()
        if (focusable.length > 0) focusable[0].focus()
      })
    } else if (previouslyFocused && previouslyFocused.focus) {
      previouslyFocused.focus()
      previouslyFocused = null
    }
  })

  return { handleKeydown }
}
