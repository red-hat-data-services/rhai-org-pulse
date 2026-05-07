import { onMounted, onUnmounted } from 'vue'

/**
 * Composable that calls a handler when a click occurs outside a given element.
 *
 * If no element ref is provided, the handler is called on every document click
 * (useful for closing menus where the toggle button uses @click.stop).
 *
 * @param {import('vue').Ref<HTMLElement|null>} [elementRef] - template ref to the container element
 * @param {Function} handler - called when a click outside the element is detected
 */
export function useClickOutside(elementRef, handler) {
  function listener(event) {
    // If no element ref or the element doesn't exist yet, always fire
    if (!elementRef || !elementRef.value) {
      handler(event)
      return
    }
    // If click is inside the element, ignore
    if (elementRef.value.contains(event.target)) return
    handler(event)
  }

  onMounted(function() {
    document.addEventListener('click', listener)
  })

  onUnmounted(function() {
    document.removeEventListener('click', listener)
  })
}
