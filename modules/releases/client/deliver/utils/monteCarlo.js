/**
 * Box-Muller transform — returns a standard-normal random variate.
 */
export function boxMullerNormal() {
  const u1 = Math.random()
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

/**
 * Marsaglia & Tsang rejection method for gamma-distributed variates.
 */
export function gammaSample(shape, scale) {
  if (shape < 1) return gammaSample(shape + 1, scale) * Math.pow(Math.random(), 1 / shape)
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (let iter = 0; iter < 1000; iter++) {
    let x, v
    do { x = boxMullerNormal(); v = 1 + c * x } while (v <= 0)
    v = v * v * v
    const u = Math.random()
    if (u < 1 - 0.0331 * x * x * x * x) return d * v * scale
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale
  }
  return shape * scale
}
