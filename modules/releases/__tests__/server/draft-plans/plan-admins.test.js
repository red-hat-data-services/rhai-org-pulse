import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const {
  isDraftPlansViewerEmail,
  isPlanAdminEmail,
  emailsMatch,
  DEFAULT_VIEWER_EMAILS,
  DEFAULT_PLAN_ADMIN_EMAILS
} = require('../../../server/draft-plans/plan-admins')

describe('draft-plans plan-admins email matching', function() {
  var prevAuthDomain

  beforeEach(function() {
    prevAuthDomain = process.env.AUTH_EMAIL_DOMAIN
    delete process.env.AUTH_EMAIL_DOMAIN
  })

  afterEach(function() {
    if (prevAuthDomain === undefined) delete process.env.AUTH_EMAIL_DOMAIN
    else process.env.AUTH_EMAIL_DOMAIN = prevAuthDomain
  })

  it('matches exact full emails when AUTH_EMAIL_DOMAIN is unset', function() {
    expect(isDraftPlansViewerEmail('emarion@redhat.com', DEFAULT_VIEWER_EMAILS)).toBe(true)
    expect(isDraftPlansViewerEmail('emarion@cluster.local', DEFAULT_VIEWER_EMAILS)).toBe(false)
    expect(isPlanAdminEmail('trozell@redhat.com', DEFAULT_PLAN_ADMIN_EMAILS)).toBe(true)
  })

  it('matches redhat.com allowlist entry against cluster.local session', function() {
    process.env.AUTH_EMAIL_DOMAIN = 'cluster.local'
    expect(isDraftPlansViewerEmail('emarion@cluster.local', ['emarion@redhat.com'])).toBe(true)
    expect(isPlanAdminEmail('emarion@cluster.local', ['emarion@redhat.com'])).toBe(true)
    expect(isPlanAdminEmail('trozell@cluster.local', DEFAULT_PLAN_ADMIN_EMAILS)).toBe(true)
  })

  it('matches cluster.local allowlist entry against redhat.com session', function() {
    process.env.AUTH_EMAIL_DOMAIN = 'cluster.local'
    expect(isDraftPlansViewerEmail('emarion@redhat.com', ['emarion@cluster.local'])).toBe(true)
    expect(isPlanAdminEmail('trozell@redhat.com', ['trozell@cluster.local'])).toBe(true)
    expect(emailsMatch('user@redhat.com', 'user@cluster.local')).toBe(true)
  })

  it('denies unrelated emails even with AUTH_EMAIL_DOMAIN set', function() {
    process.env.AUTH_EMAIL_DOMAIN = 'cluster.local'
    expect(isDraftPlansViewerEmail('alice@cluster.local', ['emarion@redhat.com'])).toBe(false)
    expect(isPlanAdminEmail('alice@redhat.com', DEFAULT_PLAN_ADMIN_EMAILS)).toBe(false)
    expect(emailsMatch('alice@redhat.com', 'emarion@cluster.local')).toBe(false)
  })
})
