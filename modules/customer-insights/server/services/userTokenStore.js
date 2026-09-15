'use strict'

const { createGoogleUserTokenStore } = require('../../../../server/google-user-oauth')

function createUserTokenStore(storage) {
  return createGoogleUserTokenStore(storage)
}

module.exports = { createUserTokenStore }
