export function computeWheelRange(current, full, pivot, zoomIn, maxVisibleDays, dayMs) {
  var range = current.max - current.min
  var zoomFactor = zoomIn ? 0.87 : 1.15
  var newRange = range * zoomFactor
  var maxRange = Math.min(full.max - full.min, maxVisibleDays * dayMs)

  if (newRange >= maxRange) {
    var center = (current.min + current.max) / 2
    return {
      min: Math.max(center - maxRange / 2, full.min),
      max: Math.min(center + maxRange / 2, full.max)
    }
  }

  var minRange = maxRange * 0.01
  if (newRange < minRange) newRange = minRange
  var ratio = (pivot - current.min) / range
  var newMin = pivot - newRange * ratio
  var newMax = newMin + newRange
  if (newMin < full.min) { newMin = full.min; newMax = newMin + newRange }
  if (newMax > full.max) { newMax = full.max; newMin = newMax - newRange }
  return { min: newMin, max: newMax }
}

export function computePanRange(start, dx, pixelRange, full) {
  var dataRange = start.max - start.min
  var shift = -(dx / pixelRange) * dataRange
  var newMin = start.min + shift
  var newMax = start.max + shift
  if (newMin < full.min) { newMin = full.min; newMax = newMin + dataRange }
  if (newMax > full.max) { newMax = full.max; newMin = newMax - dataRange }
  return { min: newMin, max: newMax }
}
