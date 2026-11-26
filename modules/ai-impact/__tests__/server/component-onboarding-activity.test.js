import { describe, it, expect } from 'vitest';
import {
  validateComponentOnboarding,
  deriveCompletionStatus
} from '../../server/component-onboarding/validation.js';
import {
  projectComponent,
  trimForHistory
} from '../../server/component-onboarding/storage.js';

const base = {
  key: 'RHOAIENG-1',
  summary: 'Test onboarding',
  status: 'In Progress',
  completionStatus: 'in-progress',
  productContext: 'ODH',
  syncedAt: '2026-01-01T00:00:00.000Z'
};

describe('validateComponentOnboarding activity', () => {
  it('defaults to onboarding when the field is absent', () => {
    const result = validateComponentOnboarding({ ...base });

    expect(result.valid).toBe(true);
    expect(result.data.activity).toBe('onboarding');
    expect(result.data.offboardingSteps).toEqual({});
  });

  it('accepts offboarding records with offboardingSteps', () => {
    const result = validateComponentOnboarding({
      ...base,
      activity: 'offboarding',
      offboardingSteps: { validate: true, removeKrd: false }
    });

    expect(result.valid).toBe(true);
    expect(result.data.activity).toBe('offboarding');
    expect(result.data.offboardingSteps).toEqual({ validate: true, removeKrd: false });
  });

  it('rejects unknown activity values', () => {
    const result = validateComponentOnboarding({ ...base, activity: 'retirement' });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('activity must be one of: onboarding, offboarding');
  });

  it('rejects non-boolean offboardingSteps values', () => {
    const result = validateComponentOnboarding({
      ...base,
      activity: 'offboarding',
      offboardingSteps: { validate: 'yes' }
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('offboardingSteps.validate must be a boolean');
  });
});

describe('deriveCompletionStatus offboarding', () => {
  it('treats the offboarding completed label as completed', () => {
    expect(deriveCompletionStatus('In Progress', 'in-progress', {
      labels: ['component-offboarding-completed']
    })).toBe('completed');
  });
});

describe('component onboarding projection activity', () => {
  it('defaults legacy records without activity to onboarding', () => {
    const projected = projectComponent({ latest: { ...base, onboardingSteps: {} }, history: [] });

    expect(projected.activity).toBe('onboarding');
    expect(projected.offboardingSteps).toEqual({});
  });

  it('projects offboarding activity and steps', () => {
    const projected = projectComponent({
      latest: {
        ...base,
        activity: 'offboarding',
        onboardingSteps: {},
        offboardingSteps: { validate: true }
      },
      history: []
    });

    expect(projected.activity).toBe('offboarding');
    expect(projected.offboardingSteps).toEqual({ validate: true });
  });

  it('keeps activity and offboarding steps in history entries', () => {
    const trimmed = trimForHistory({
      ...base,
      activity: 'offboarding',
      offboardingSteps: { validate: true }
    });

    expect(trimmed.activity).toBe('offboarding');
    expect(trimmed.offboardingSteps).toEqual({ validate: true });
  });
});
