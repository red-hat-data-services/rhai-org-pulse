/**
 * Parse wheel and sdist filenames into structured package file objects.
 * Wheel format (PEP 427): {name}-{version}(-{build})?-{python}-{abi}-{platform}.whl
 * Sdist format: {name}-{version}.tar.gz or {name}-{version}.zip
 */

function parseWheelFilename(filename) {
  const stem = filename.slice(0, -4)
  const parts = stem.split('-')
  if (parts.length < 5) return null

  const platform = parts[parts.length - 1]
  const abi = parts[parts.length - 2]
  const python = parts[parts.length - 3]

  const remaining = parts.slice(0, parts.length - 3)
  if (remaining.length < 2) return null

  const hasBuildTag = remaining.length >= 3 && /^\d/.test(remaining[remaining.length - 1])
  const versionEnd = hasBuildTag ? remaining.length - 1 : remaining.length
  const version = remaining.slice(1, versionEnd).join('-')

  return { version, python, abi, platform }
}

function parseSdistFilename(filename) {
  let stem
  if (filename.endsWith('.tar.gz')) {
    stem = filename.slice(0, -7)
  } else if (filename.endsWith('.zip')) {
    stem = filename.slice(0, -4)
  } else {
    return null
  }

  const lastDash = stem.lastIndexOf('-')
  if (lastDash < 1) return null

  return { version: stem.slice(lastDash + 1) }
}

function parsePackageFile(filename, url) {
  if (filename.endsWith('.whl')) {
    const parsed = parseWheelFilename(filename)
    if (parsed) {
      return {
        filename,
        version: parsed.version,
        python: parsed.python,
        abi: parsed.abi,
        platform: parsed.platform,
        url
      }
    }
  }

  if (filename.endsWith('.tar.gz') || filename.endsWith('.zip')) {
    const parsed = parseSdistFilename(filename)
    if (parsed) {
      return {
        filename,
        version: parsed.version,
        python: null,
        abi: null,
        platform: null,
        url
      }
    }
  }

  return {
    filename,
    version: 'unknown',
    python: null,
    abi: null,
    platform: null,
    url
  }
}

module.exports = { parsePackageFile, parseWheelFilename, parseSdistFilename }
