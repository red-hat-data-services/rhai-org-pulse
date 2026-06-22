/**
 * Parse wheel and sdist filenames into structured package file objects.
 * Wheel format (PEP 427): {name}-{version}(-{build})?-{python}-{abi}-{platform}.whl
 * Sdist format: {name}-{version}.tar.gz or {name}-{version}.zip
 */

function parseWheelFilename(filename) {
  const stem = filename.slice(0, -4)
  const parts = stem.split('-')
  // PEP 427: name-version-python-abi-platform (5 parts)
  //      or: name-version-build-python-abi-platform (6 parts)
  if (parts.length === 5) {
    return { version: parts[1], python: parts[2], abi: parts[3], platform: parts[4] }
  }
  if (parts.length === 6) {
    return { version: parts[1], python: parts[3], abi: parts[4], platform: parts[5] }
  }
  return null
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
