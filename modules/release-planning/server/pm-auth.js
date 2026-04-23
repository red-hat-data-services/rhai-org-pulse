/**
 * PM role middleware and user management.
 *
 * PMs (Product Managers) can edit Big Rocks and import data.
 * Admins can always do everything a PM can, plus manage the PM list.
 */

function createRequirePM(readFromStorage) {
  function isPM(email) {
    var pmList = readFromStorage('release-planning/pm-users.json')
    return pmList && pmList.emails && pmList.emails.includes(email)
  }

  return function requirePM(req, res, next) {
    if (req.isAdmin || isPM(req.userEmail)) {
      return next()
    }
    return res.status(403).json({ error: 'PM or admin access required' })
  }
}

function getPMUsers(readFromStorage) {
  var data = readFromStorage('release-planning/pm-users.json')
  return (data && data.emails) || []
}

function addPMUser(readFromStorage, writeToStorage, email) {
  var normalized = email.toLowerCase()
  var data = readFromStorage('release-planning/pm-users.json') || { emails: [] }
  if (!data.emails.includes(normalized)) {
    data.emails.push(normalized)
    writeToStorage('release-planning/pm-users.json', data)
  }
  return data.emails
}

function removePMUser(readFromStorage, writeToStorage, email) {
  var normalized = email.toLowerCase()
  var data = readFromStorage('release-planning/pm-users.json') || { emails: [] }
  data.emails = data.emails.filter(function(e) { return e !== normalized })
  writeToStorage('release-planning/pm-users.json', data)
  return data.emails
}

module.exports = { createRequirePM, getPMUsers, addPMUser, removePMUser }
