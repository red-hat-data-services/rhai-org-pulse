import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// @org-pulse/core moved getAllPeople to an async function. The roster push used
// to call it synchronously, so `allPeople` was a Promise and the for..of threw
// "allPeople is not iterable". These tests inject an async reader to pin that
// contract.
import registerRoutes from '../../server/index.js';

const asyncPeople = (people) => async () => people;

describe('pushRosterToUpstream', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.UPSTREAM_PULSE_API_URL = 'http://upstream.test';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('awaits an async getAllPeople and forwards only people with a GitHub username', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, inserted: 1, relinked: 292 })
    }));
    global.fetch = fetchMock;

    const result = await registerRoutes.pushRosterToUpstream(
      {},
      {
        getAllPeople: asyncPeople([
          {
            uid: 'hnunes',
            name: 'Henrique Nunes',
            email: 'hnunes@redhat.com',
            github: { username: 'hjrnunes' }
          },
          {
            uid: 'nogithub',
            name: 'No GitHub Handle',
            email: 'nogithub@redhat.com'
          }
        ])
      }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://upstream.test/api/admin/team-members/sync');

    const body = JSON.parse(options.body);
    expect(body.source).toBe('org_pulse_roster');
    expect(body.replacesSources).toEqual(['github_org_sync']);
    expect(body.people).toHaveLength(1);
    expect(body.people[0]).toMatchObject({
      name: 'Henrique Nunes',
      githubUsername: 'hjrnunes',
      employeeId: 'hnunes'
    });
    expect(result.relinked).toBe(292);
  });

  it('sends the service identity headers so upstream treats it as admin', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    global.fetch = fetchMock;

    await registerRoutes.pushRosterToUpstream(
      {},
      { getAllPeople: asyncPeople([{ uid: 'a', name: 'A', github: { username: 'alice' } }]) }
    );

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['x-forwarded-user']).toBe('roster-sync-service');
    expect(options.headers['x-forwarded-email']).toBe('roster-sync-service@internal');
  });

  it('skips the push when nobody has a GitHub username', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const result = await registerRoutes.pushRosterToUpstream(
      {},
      { getAllPeople: asyncPeople([{ uid: 'a', name: 'A', email: 'a@redhat.com' }]) }
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ skipped: true, reason: 'no_people' });
  });

  it('surfaces the upstream error instead of silently succeeding', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Forbidden' })
    }));

    await expect(
      registerRoutes.pushRosterToUpstream(
        {},
        { getAllPeople: asyncPeople([{ uid: 'a', name: 'A', github: { username: 'alice' } }]) }
      )
    ).rejects.toThrow(/403/);
  });
});
