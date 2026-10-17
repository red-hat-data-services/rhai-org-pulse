import { describe, it, expect, vi } from 'vitest';

import { createFeedClient, FeedError } from '../../server/feed-client.js';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

describe('createFeedClient', () => {
  it('lists boards with bearer auth against /feed/boards.json', async () => {
    const fetchFn = vi.fn(async (url, options) => {
      expect(url).toBe('https://feed.example.test/feed/boards.json');
      expect(options.headers.Authorization).toBe('Bearer token-123');
      return jsonResponse(200, { boards: ['board-2026-09', 'board-2026-10'] });
    });
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 'token-123', fetchFn });

    await expect(client.listBoards()).resolves.toEqual(['board-2026-09', 'board-2026-10']);
  });

  it('strips trailing slashes from the base url', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { boards: [] }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test/', token: 't', fetchFn });

    await client.listBoards();
    expect(fetchFn.mock.calls[0][0]).toBe('https://feed.example.test/feed/boards.json');
  });

  it('fetches a single board with an encoded board name', async () => {
    const fetchFn = vi.fn(async (url) => {
      expect(url).toBe('https://feed.example.test/feed/board.json?board=board-2026-09');
      return jsonResponse(200, { kind: 'board', name: 'board-2026-09', count: 0, columns: [], rows: [] });
    });
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    await expect(client.getBoard('board-2026-09')).resolves.toEqual({
      kind: 'board', name: 'board-2026-09', count: 0, columns: [], rows: [],
    });
  });

  it('fetches showcase data from /feed/showcase.json', async () => {
    const fetchFn = vi.fn(async (url) => {
      expect(url).toBe('https://feed.example.test/feed/showcase.json');
      return jsonResponse(200, { showcase_entries: [], strategy_pillars: [], site_config: {}, generated_at: 'x' });
    });
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    await expect(client.getShowcase()).resolves.toEqual({
      showcase_entries: [], strategy_pillars: [], site_config: {}, generated_at: 'x',
    });
  });

  it('rejects a response naming a different board', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { name: 'board-2026-10', count: 0, rows: [] }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    await expect(client.getBoard('board-2026-09')).rejects.toThrow('board-2026-09');
  });

  it('maps 401 to an actionable unauthorized error', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(401, { error: 'unauthorized' }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 'bad', fetchFn });

    const err = await client.listBoards().catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.status).toBe(401);
    expect(err.message).toBe('unauthorized — check POC_EXPLORER_FEED_TOKEN');
  });

  it('maps 404 to an unknown board error carrying the response body', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(404, {
      error: 'unknown board',
      known: ['board-2026-09'],
    }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    const err = await client.getBoard('board-1999-01').catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.status).toBe(404);
    expect(err.message).toContain('unknown board');
    expect(err.message).toContain('1 known');
    expect(err.body).toEqual({ error: 'unknown board', known: ['board-2026-09'] });
  });

  it('falls back to a generic 404 message when the body carries no error', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 404, text: async () => '' }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    const err = await client.getShowcase().catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.status).toBe(404);
    expect(err.message).toContain('not found at /feed/showcase.json');
  });

  it('maps network failures to an actionable message', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('ECONNREFUSED'); });
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    const err = await client.listBoards().catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.message).toContain('feed.example.test');
    expect(err.message).toContain('POC_EXPLORER_FEED_URL');
  });

  it('times out when the response body stalls after headers arrive', async () => {
    const fetchFn = vi.fn(async (_url, { signal }) => ({
      ok: true,
      status: 200,
      text: () => new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
      }),
    }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn, timeoutMs: 20 });

    const err = await client.listBoards().catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.message).toContain('timed out');
  }, 500);

  it('times out long-running requests', async () => {
    const fetchFn = vi.fn((url, options) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn, timeoutMs: 20 });

    const err = await client.listBoards().catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.message).toContain('timed out');
  });

  it('rejects unexpected boards.json response shapes instead of returning an empty list', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { nope: [] }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    const err = await client.listBoards().catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.message).toContain('/feed/boards.json');
    expect(err.message).toContain('boards');
  });

  it('rejects boards.json payloads with non-string board names', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { boards: [null] }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    const err = await client.listBoards().catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.message).toContain('/feed/boards.json');
    expect(err.message).toContain('string');
  });

  it('rejects unexpected board.json response shapes instead of returning zero rows', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, {}));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    const err = await client.getBoard('board-2026-09').catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.message).toContain('/feed/board.json');
    expect(err.message).toContain('rows');
  });

  it('rejects board.json payloads whose count disagrees with the rows length', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { count: 145, rows: [] }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    const err = await client.getBoard('board-2026-09').catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.message).toContain('count');
    expect(err.message).toContain('145');
  });

  it('rejects board.json payloads without a numeric count', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { rows: [] }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    const err = await client.getBoard('board-2026-09').catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.message).toContain('count');
  });

  it('rejects board.json payloads with non-object rows', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { count: 1, rows: ['not-an-object'] }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    const err = await client.getBoard('board-2026-09').catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.message).toContain('rows');
    expect(err.message).toContain('object');
  });

  it('rejects board.json payloads with object cell values', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, {
      count: 1,
      rows: [{ title: 'Drifted Entry', unique_id: 'org/drift', pm_decision: { decision: 'Approve' } }],
    }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    const err = await client.getBoard('board-2026-09').catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.message).toContain('/feed/board.json');
    expect(err.message).toContain('strings');
  });

  it('rejects board.json payloads with number cell values', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, {
      count: 1,
      rows: [{ title: 'Drifted Entry', unique_id: 'org/drift', impact_score: 9 }],
    }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    const err = await client.getBoard('board-2026-09').catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.message).toContain('/feed/board.json');
    expect(err.message).toContain('strings');
  });

  it('accepts board.json rows with null cells', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, {
      count: 1,
      rows: [{ title: 'Sparse Entry', unique_id: 'org/sparse', pm_decision: null }],
    }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    await expect(client.getBoard('board-2026-09')).resolves.toMatchObject({ count: 1 });
  });

  it('accepts a legitimately empty board', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { count: 0, rows: [] }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    await expect(client.getBoard('board-2026-09')).resolves.toEqual({ count: 0, rows: [] });
  });

  it('rejects unexpected showcase.json response shapes instead of returning empty catalogs', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { nope: [] }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    const err = await client.getShowcase().catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.message).toContain('/feed/showcase.json');
  });

  it('rejects showcase.json payloads with null or non-object showcase_entries rows', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { showcase_entries: [null], strategy_pillars: [] }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    const err = await client.getShowcase().catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.message).toContain('showcase_entries');
    expect(err.message).toContain('objects');
  });

  it('rejects showcase.json payloads with non-object strategy_pillars rows', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { showcase_entries: [], strategy_pillars: [{ pillar_key: 'ok' }, 'garbage'] }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    const err = await client.getShowcase().catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.message).toContain('strategy_pillars');
    expect(err.message).toContain('objects');
  });

  it('accepts legitimately empty showcase arrays', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { showcase_entries: [], strategy_pillars: [] }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    await expect(client.getShowcase()).resolves.toEqual({ showcase_entries: [], strategy_pillars: [] });
  });

  it('rejects non-JSON responses', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, text: async () => '<html>oops</html>' }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    const err = await client.listBoards().catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.message).toContain('non-JSON');
  });

  it('rejects other HTTP errors with the status code', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(500, { error: 'boom' }));
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: 't', fetchFn });

    const err = await client.listBoards().catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.status).toBe(500);
  });

  it('throws before fetching when no token is configured', async () => {
    const fetchFn = vi.fn();
    const client = createFeedClient({ baseUrl: 'https://feed.example.test', token: '', fetchFn });

    await expect(client.listBoards()).rejects.toThrow(/POC_EXPLORER_FEED_TOKEN/);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('createFeedClient destination validation', () => {
  it('rejects non-HTTPS URLs before fetching', async () => {
    const fetchFn = vi.fn();
    const client = createFeedClient({ baseUrl: 'http://feed.example.test', token: 't', fetchFn });

    const err = await client.listBoards().catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.message).toContain('HTTPS');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('allows HTTP on localhost when allowLoopback is opted in', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { boards: [] }));
    const client = createFeedClient({ baseUrl: 'http://localhost:3001', token: 't', fetchFn, allowLoopback: true });

    await client.listBoards();
    expect(fetchFn).toHaveBeenCalledWith('http://localhost:3001/feed/boards.json', expect.anything());
  });

  it('allows HTTP on 127.0.0.1 when allowLoopback is opted in', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { boards: [] }));
    const client = createFeedClient({ baseUrl: 'http://127.0.0.1:3001', token: 't', fetchFn, allowLoopback: true });

    await client.listBoards();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('allows HTTP on [::1] when allowLoopback is opted in', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { boards: [] }));
    const client = createFeedClient({ baseUrl: 'http://[::1]:3001', token: 't', fetchFn, allowLoopback: true });

    await client.listBoards();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('rejects loopback URLs before fetching unless allowLoopback is opted in', async () => {
    const fetchFn = vi.fn();
    const client = createFeedClient({ baseUrl: 'http://127.0.0.1:9090', token: 't', fetchFn });

    const err = await client.listBoards().catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.message).toContain('POC_EXPLORER_ALLOW_LOOPBACK');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rejects URLs whose origin is not in allowedOrigins before fetching', async () => {
    const fetchFn = vi.fn();
    const client = createFeedClient({
      baseUrl: 'https://evil.example.test',
      token: 't',
      fetchFn,
      allowedOrigins: ['https://feed.example.test'],
    });

    const err = await client.listBoards().catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.message).toContain('not an approved origin');
    expect(err.message).toContain('https://evil.example.test');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('allows URLs whose origin is in allowedOrigins', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { boards: [] }));
    const client = createFeedClient({
      baseUrl: 'https://feed.example.test',
      token: 't',
      fetchFn,
      allowedOrigins: ['https://feed.example.test'],
    });

    await client.listBoards();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('lets loopback bypass the allowedOrigins check so local stubs work on ephemeral ports', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { boards: [] }));
    const client = createFeedClient({
      baseUrl: 'http://127.0.0.1:45678',
      token: 't',
      fetchFn,
      allowedOrigins: ['https://feed.example.test'],
      allowLoopback: true,
    });

    await client.listBoards();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('rejects URLs that do not parse before fetching', async () => {
    const fetchFn = vi.fn();
    const client = createFeedClient({ baseUrl: 'not a url', token: 't', fetchFn });

    const err = await client.listBoards().catch(e => e);
    expect(err).toBeInstanceOf(FeedError);
    expect(err.message).toContain('not a valid URL');
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
