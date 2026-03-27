// Populated at build time via Dockerfile ENV or at startup via git
module.exports = {
  version: process.env.APP_VERSION || require('../package.json').version,
  gitSha: process.env.GIT_SHA || null,
  buildDate: process.env.BUILD_DATE || null,
  nodeVersion: process.version
}
