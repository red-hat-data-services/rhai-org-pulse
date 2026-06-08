function buildTeamIndex(readFromStorage, version) {
  if (!version) return new Map()
  var hygieneData = readFromStorage('releases/hygiene/features-' + version + '.json')
  if (!hygieneData || !hygieneData.features) return new Map()
  var index = new Map()
  var keys = Object.keys(hygieneData.features)
  for (var i = 0; i < keys.length; i++) {
    var feature = hygieneData.features[keys[i]]
    if (feature && feature.team) index.set(keys[i], feature.team)
  }
  return index
}

module.exports = { buildTeamIndex: buildTeamIndex }
