import { describe, it, expect } from 'vitest';
import { categorizeFeatures, effectiveHealth } from '../../../client/execute/helpers/signal-groups';

function findGroup(groups, id) {
  return groups.find(g => g.id === id);
}

function groupIds(groups) {
  return groups.map(g => g.id);
}

describe('effectiveHealth', () => {
  it('returns pipeline health when present', () => {
    expect(effectiveHealth({ health: 'RED' })).toBe('RED');
    expect(effectiveHealth({ health: 'GREEN' })).toBe('GREEN');
    expect(effectiveHealth({ health: 'YELLOW' })).toBe('YELLOW');
  });

  it('infers GREEN from Jira In Progress when health is null', () => {
    expect(effectiveHealth({ health: null, statusCategory: 'In Progress' })).toBe('GREEN');
  });

  it('defaults to YELLOW when health is null and statusCategory is To Do', () => {
    expect(effectiveHealth({ health: null, statusCategory: 'To Do' })).toBe('YELLOW');
  });

  it('defaults to YELLOW when health is null and no statusCategory', () => {
    expect(effectiveHealth({ health: null })).toBe('YELLOW');
    expect(effectiveHealth({})).toBe('YELLOW');
  });
});

describe('categorizeFeatures', () => {
  it('places 100% completion features in complete', () => {
    const features = [
      { key: 'F-1', completionPct: 100, health: 'GREEN', statusCategory: 'In Progress', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'complete').features).toHaveLength(1);
  });

  it('places Jira Done features in complete regardless of pipeline health', () => {
    const features = [
      { key: 'F-1', completionPct: 98, health: 'RED', statusCategory: 'Done', blockerCount: 0 },
      { key: 'F-2', completionPct: 50, health: 'YELLOW', statusCategory: 'Done', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    const complete = findGroup(groups, 'complete');
    expect(complete.features).toHaveLength(2);
    expect(complete.features.map(f => f.key)).toEqual(['F-1', 'F-2']);
  });

  it('does not place Jira Done features in needs-attention even with RED health', () => {
    const features = [
      { key: 'F-1', completionPct: 91, health: 'RED', statusCategory: 'Done', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'red-other')).toBeUndefined();
    expect(findGroup(groups, 'complete').features).toHaveLength(1);
  });

  it('places RED health features with blockers in blocked', () => {
    const features = [
      { key: 'F-1', completionPct: 50, health: 'RED', statusCategory: 'In Progress', blockerCount: 3 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'blocked').features).toHaveLength(1);
  });

  it('places RED health features without blockers in needs-attention', () => {
    const features = [
      { key: 'F-1', completionPct: 50, health: 'RED', statusCategory: 'In Progress', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'red-other').features).toHaveLength(1);
  });

  it('does not place Jira In Progress features in not-started even with 0% completion', () => {
    const features = [
      { key: 'F-1', completionPct: 0, health: 'YELLOW', statusCategory: 'In Progress', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'not-started')).toBeUndefined();
    expect(findGroup(groups, 'at-risk').features).toHaveLength(1);
  });

  it('places To Do features with 0% in not-started', () => {
    const features = [
      { key: 'F-1', completionPct: 0, health: 'YELLOW', statusCategory: 'To Do', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'not-started').features).toHaveLength(1);
  });

  it('places YELLOW health features with progress in at-risk', () => {
    const features = [
      { key: 'F-1', completionPct: 30, health: 'YELLOW', statusCategory: 'In Progress', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'at-risk').features).toHaveLength(1);
  });

  it('places GREEN health features in on-track', () => {
    const features = [
      { key: 'F-1', completionPct: 60, health: 'GREEN', statusCategory: 'In Progress', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'on-track').features).toHaveLength(1);
  });

  it('handles null health by inferring from statusCategory', () => {
    const features = [
      { key: 'F-1', completionPct: 0, health: null, statusCategory: 'In Progress', blockerCount: 0 },
      { key: 'F-2', completionPct: 0, health: null, statusCategory: 'To Do', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'on-track').features.map(f => f.key)).toEqual(['F-1']);
    expect(findGroup(groups, 'not-started').features.map(f => f.key)).toEqual(['F-2']);
  });

  it('omits empty groups', () => {
    const features = [
      { key: 'F-1', completionPct: 100, health: 'GREEN', statusCategory: 'Done', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('complete');
  });

  it('categorizes a mixed set correctly', () => {
    const features = [
      { key: 'DONE-1', completionPct: 100, health: 'GREEN', statusCategory: 'Done', blockerCount: 0 },
      { key: 'DONE-2', completionPct: 95, health: 'RED', statusCategory: 'Done', blockerCount: 0 },
      { key: 'BLOCK-1', completionPct: 40, health: 'RED', statusCategory: 'In Progress', blockerCount: 2 },
      { key: 'ATTN-1', completionPct: 30, health: 'RED', statusCategory: 'In Progress', blockerCount: 0 },
      { key: 'RISK-1', completionPct: 20, health: 'YELLOW', statusCategory: 'In Progress', blockerCount: 0 },
      { key: 'RISK-2', completionPct: 0, health: 'YELLOW', statusCategory: 'In Progress', blockerCount: 0 },
      { key: 'TODO-1', completionPct: 0, health: 'YELLOW', statusCategory: 'To Do', blockerCount: 0 },
      { key: 'TRACK-1', completionPct: 70, health: 'GREEN', statusCategory: 'In Progress', blockerCount: 0 },
      { key: 'NULL-1', completionPct: 0, health: null, statusCategory: 'In Progress', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(findGroup(groups, 'complete').features.map(f => f.key)).toEqual(['DONE-1', 'DONE-2']);
    expect(findGroup(groups, 'blocked').features.map(f => f.key)).toEqual(['BLOCK-1']);
    expect(findGroup(groups, 'red-other').features.map(f => f.key)).toEqual(['ATTN-1']);
    expect(findGroup(groups, 'at-risk').features.map(f => f.key)).toEqual(['RISK-1', 'RISK-2']);
    expect(findGroup(groups, 'not-started').features.map(f => f.key)).toEqual(['TODO-1']);
    expect(findGroup(groups, 'on-track').features.map(f => f.key)).toEqual(['TRACK-1', 'NULL-1']);
  });

  it('returns groups in the correct order', () => {
    const features = [
      { key: 'F-1', completionPct: 40, health: 'RED', statusCategory: 'In Progress', blockerCount: 2 },
      { key: 'F-2', completionPct: 30, health: 'RED', statusCategory: 'In Progress', blockerCount: 0 },
      { key: 'F-3', completionPct: 20, health: 'YELLOW', statusCategory: 'In Progress', blockerCount: 0 },
      { key: 'F-4', completionPct: 0, health: 'YELLOW', statusCategory: 'To Do', blockerCount: 0 },
      { key: 'F-5', completionPct: 70, health: 'GREEN', statusCategory: 'In Progress', blockerCount: 0 },
      { key: 'F-6', completionPct: 100, health: 'GREEN', statusCategory: 'Done', blockerCount: 0 }
    ];
    const groups = categorizeFeatures(features);
    expect(groupIds(groups)).toEqual(['blocked', 'red-other', 'at-risk', 'not-started', 'on-track', 'complete']);
  });
});
