// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { classifyIssue, getJiraFields } from '../classify.js';

describe('classifyIssue', () => {
  it('classifies Tech Debt & Quality', () => {
    expect(classifyIssue({ activityType: 'Tech Debt & Quality' })).toBe('tech-debt-quality');
  });

  it('classifies New Features', () => {
    expect(classifyIssue({ activityType: 'New Features' })).toBe('new-features');
  });

  it('classifies Learning & Enablement', () => {
    expect(classifyIssue({ activityType: 'Learning & Enablement' })).toBe('learning-enablement');
  });

  it('classifies null activityType as uncategorized', () => {
    expect(classifyIssue({ activityType: null })).toBe('uncategorized');
  });

  it('classifies undefined activityType as uncategorized', () => {
    expect(classifyIssue({})).toBe('uncategorized');
  });

  it('classifies unknown activityType as uncategorized', () => {
    expect(classifyIssue({ activityType: 'Something Else' })).toBe('uncategorized');
  });

  it('classifies Vulnerability issue type as tech-debt-quality regardless of activityType', () => {
    expect(classifyIssue({ issueType: 'Vulnerability', activityType: null })).toBe('tech-debt-quality');
    expect(classifyIssue({ issueType: 'Vulnerability', activityType: 'New Features' })).toBe('tech-debt-quality');
  });

  it('classifies Weakness issue type as tech-debt-quality regardless of activityType', () => {
    expect(classifyIssue({ issueType: 'Weakness', activityType: null })).toBe('tech-debt-quality');
    expect(classifyIssue({ issueType: 'Weakness', activityType: 'New Features' })).toBe('tech-debt-quality');
  });
});

describe('getJiraFields', () => {
  it('declares customfield_10464 for activityType', () => {
    const fields = getJiraFields();
    expect(fields.fieldIds).toContain('customfield_10464');
  });

  it('extracts activityType from Jira fields', () => {
    const fields = getJiraFields();
    const result = fields.extract({}, { customfield_10464: { value: 'Tech Debt & Quality' } });
    expect(result.activityType).toBe('Tech Debt & Quality');
  });

  it('returns null activityType when field is missing', () => {
    const fields = getJiraFields();
    const result = fields.extract({}, {});
    expect(result.activityType).toBeNull();
  });
});
