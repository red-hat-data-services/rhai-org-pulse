/**
 * Compute cumulative bug count per version vs days since release
 *
 * @param {Array} bugs - Filtered bug objects
 * @param {string[]} versions - Selected version names
 * @param {Map} versionReleaseMap - Map of version name to release date string
 * @param {Object} [options]
 * @param {number} [options.now] - Current timestamp in ms (defaults to Date.now())
 * @returns {Object} - { labels: [0, 1, 2, ...], datasets: [{ label, data }, ...] }
 */
function computeCumulativeBugData(bugs, versions, versionReleaseMap, options) {

  const versionBugs = new Map();

  for (const version of versions) {
    const releaseDate = versionReleaseMap.get(version);
    if (!releaseDate) continue;

    const releaseDateMs = new Date(releaseDate).getTime();

    const bugsForVersion = bugs
      .filter(bug => bug.affectedVersions.includes(version))
      .map(bug => ({
        key: bug.key,
        daysSinceRelease: Math.floor((new Date(bug.created).getTime() - releaseDateMs) / (24 * 60 * 60 * 1000))
      }))
      .filter(b => b.daysSinceRelease >= 0)
      .sort((a, b) => a.daysSinceRelease - b.daysSinceRelease);

    versionBugs.set(version, bugsForVersion);
  }

  let maxDays = -1;
  for (const entries of versionBugs.values()) {
    if (entries.length > 0) {
      maxDays = Math.max(maxDays, entries[entries.length - 1].daysSinceRelease);
    }
  }

  if (maxDays < 0) {
    return {
      labels: [],
      datasets: versions.map(v => ({ label: v, data: [] }))
    };
  }

  const now = options?.now ?? Date.now();

  const labels = Array.from({ length: maxDays + 1 }, (_, i) => i);

  const datasets = versions.map(version => {
    const entries = versionBugs.get(version) || [];
    const releaseDate = versionReleaseMap.get(version);
    const elapsedDays = releaseDate
      ? Math.floor((now - new Date(releaseDate).getTime()) / (24 * 60 * 60 * 1000))
      : maxDays;

    const data = new Array(maxDays + 1).fill(null);

    let cumulativeCount = 0;
    let bugIndex = 0;

    const cap = Math.min(elapsedDays, maxDays);
    for (let day = 0; day <= cap; day++) {
      while (bugIndex < entries.length && entries[bugIndex].daysSinceRelease === day) {
        cumulativeCount++;
        bugIndex++;
      }
      data[day] = cumulativeCount;
    }

    return {
      label: version,
      data
    };
  });

  return { labels, datasets };
}

module.exports = { computeCumulativeBugData };
