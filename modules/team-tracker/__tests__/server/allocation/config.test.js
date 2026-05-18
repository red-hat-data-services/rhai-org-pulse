// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  STORAGE_PREFIX,
  allocationKey
} from '../../../server/allocation/config.js';

describe('STORAGE_PREFIX', () => {
  it('is allocation/', () => {
    expect(STORAGE_PREFIX).toBe('allocation/');
  });
});

describe('allocationKey', () => {
  it('prepends allocation/ prefix', () => {
    expect(allocationKey('sprints/100.json')).toBe('allocation/sprints/100.json');
  });

  it('works with simple keys', () => {
    expect(allocationKey('config/classification.json')).toBe('allocation/config/classification.json');
  });

  it('works with summaries', () => {
    expect(allocationKey('summaries/global.json')).toBe('allocation/summaries/global.json');
  });
});
