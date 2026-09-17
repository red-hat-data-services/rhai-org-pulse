import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import FeatureListItem from '../../client/components/FeatureListItem.vue';

function makeFeature(overrides = {}) {
  return {
    key: 'OSAC-1',
    title: 'Some feature',
    priority: 'Major',
    humanReviewStatus: 'awaiting-review',
    recommendation: null,
    scores: null,
    designPrStatus: null,
    designPrUrl: null,
    ...overrides
  };
}

describe('FeatureListItem Missing Design badge', () => {
  it('shows Missing Design when designPrStatus is null', () => {
    const wrapper = mount(FeatureListItem, { props: { feature: makeFeature() } });
    expect(wrapper.text()).toContain('Missing Design');
  });

  it('does not show Missing Design for an existing-but-unscored Design artifact', () => {
    const feature = makeFeature({ designPrStatus: 'Merged', designPrUrl: null, scores: null });
    const wrapper = mount(FeatureListItem, { props: { feature } });
    expect(wrapper.text()).not.toContain('Missing Design');
  });

  it('renders separate canonical PRD and Design PR links', () => {
    const feature = makeFeature({
      designPrStatus: 'Open',
      prdPrUrl: 'https://github.com/org/repo/pull/168',
      designPrUrl: 'https://github.com/org/repo/pull/208'
    });
    const wrapper = mount(FeatureListItem, { props: { feature } });
    const links = wrapper.findAll('a');

    expect(links.map(link => link.attributes('href'))).toEqual([
      'https://github.com/org/repo/pull/168',
      'https://github.com/org/repo/pull/208'
    ]);
    expect(links[0].attributes('title')).toBe('View PRD pull request on GitHub');
    expect(links[1].attributes('title')).toBe('View design pull request on GitHub');
  });
});

describe('FeatureListItem Review pill (meaningful humanReviewStatus only)', () => {
  it('existing + unscored + default awaiting-review: hides the Review pill', () => {
    const feature = makeFeature({ designPrStatus: 'Merged', scores: null, humanReviewStatus: 'awaiting-review' });
    const wrapper = mount(FeatureListItem, { props: { feature } });
    expect(wrapper.text()).not.toContain('Review');
    expect(wrapper.text()).not.toContain('Awaiting Sign-off');
  });

  it('existing + unscored + approved: shows Approved', () => {
    const feature = makeFeature({ designPrStatus: 'Merged', scores: null, humanReviewStatus: 'approved' });
    const wrapper = mount(FeatureListItem, { props: { feature } });
    expect(wrapper.text()).toContain('Approved');
  });

  it('existing + unscored + needs-review: shows Flagged', () => {
    const feature = makeFeature({ designPrStatus: 'Merged', scores: null, humanReviewStatus: 'needs-review' });
    const wrapper = mount(FeatureListItem, { props: { feature } });
    expect(wrapper.text()).toContain('Flagged');
  });

  it('existing + scored + awaiting-review: shows Awaiting Sign-off', () => {
    const feature = makeFeature({ designPrStatus: 'Merged', scores: { total: 6 }, humanReviewStatus: 'awaiting-review' });
    const wrapper = mount(FeatureListItem, { props: { feature } });
    expect(wrapper.text()).toContain('Awaiting Sign-off');
  });

  it('missing Design: hides the Review pill', () => {
    const feature = makeFeature({ designPrStatus: null, humanReviewStatus: 'approved' });
    const wrapper = mount(FeatureListItem, { props: { feature } });
    expect(wrapper.text()).not.toContain('Approved');
  });

  it('still shows Score/Priority details for an unscored Design artifact', () => {
    const feature = makeFeature({ designPrStatus: 'Merged', scores: null });
    const wrapper = mount(FeatureListItem, { props: { feature } });
    expect(wrapper.text()).toContain('N/A');
    expect(wrapper.text()).toContain('Major');
  });

  it('hides the whole review-details row when there is no Design artifact at all', () => {
    const feature = makeFeature({ designPrStatus: null });
    const wrapper = mount(FeatureListItem, { props: { feature } });
    expect(wrapper.text()).not.toContain('Score');
    expect(wrapper.text()).not.toContain('Priority');
  });
});
