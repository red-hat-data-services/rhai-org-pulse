import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

var activePinnedId = ref(null)
var idCounter = 0

export function usePopover(options) {
  var opts = options || {}
  var hoverDelay = opts.hoverDelay != null ? opts.hoverDelay : 150
  var leaveDelay = opts.leaveDelay != null ? opts.leaveDelay : 100

  var myId = ++idCounter
  var isVisible = ref(false)
  var isPinned = ref(false)
  var hoverTimeout = null
  var leaveTimeout = null

  function clearTimers() {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      hoverTimeout = null
    }
    if (leaveTimeout) {
      clearTimeout(leaveTimeout)
      leaveTimeout = null
    }
  }

  function onMouseEnter() {
    if (isPinned.value) return
    if (leaveTimeout) {
      clearTimeout(leaveTimeout)
      leaveTimeout = null
    }
    hoverTimeout = setTimeout(function() {
      isVisible.value = true
      hoverTimeout = null
    }, hoverDelay)
  }

  function onMouseLeave() {
    if (isPinned.value) return
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      hoverTimeout = null
    }
    leaveTimeout = setTimeout(function() {
      isVisible.value = false
      leaveTimeout = null
    }, leaveDelay)
  }

  function onClick(event) {
    if (event) event.stopPropagation()
    clearTimers()
    if (isPinned.value) {
      dismiss()
    } else {
      isPinned.value = true
      isVisible.value = true
      activePinnedId.value = myId
    }
  }

  function dismiss() {
    isPinned.value = false
    isVisible.value = false
    clearTimers()
    if (activePinnedId.value === myId) {
      activePinnedId.value = null
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Escape' && isPinned.value) {
      dismiss()
    }
    if ((event.key === 'Enter' || event.key === ' ') && !isPinned.value) {
      event.preventDefault()
      onClick()
    }
  }

  function handleOutsideClick(event) {
    if (!isPinned.value) return
    var popoverEl = document.querySelector('[data-popover-id="' + myId + '"]')
    var triggerEl = document.querySelector('[data-popover-trigger="' + myId + '"]')
    if (popoverEl && popoverEl.contains(event.target)) return
    if (triggerEl && triggerEl.contains(event.target)) return
    dismiss()
  }

  onMounted(function() {
    document.addEventListener('click', handleOutsideClick)
  })

  var stopWatch = watch(activePinnedId, function(newId) {
    if (newId !== myId && isPinned.value) {
      isPinned.value = false
      isVisible.value = false
      clearTimers()
    }
  })

  onBeforeUnmount(function() {
    clearTimers()
    document.removeEventListener('click', handleOutsideClick)
    stopWatch()
    if (activePinnedId.value === myId) {
      activePinnedId.value = null
    }
  })

  return {
    isVisible: isVisible,
    isPinned: isPinned,
    popoverId: myId,
    onMouseEnter: onMouseEnter,
    onMouseLeave: onMouseLeave,
    onClick: onClick,
    dismiss: dismiss,
    onKeyDown: onKeyDown
  }
}
