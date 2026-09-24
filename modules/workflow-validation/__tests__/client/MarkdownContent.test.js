import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MarkdownContent from '../../client/components/MarkdownContent.vue'

describe('Workflow Validation MarkdownContent', () => {
  it('renders Markdown structure and sanitizes untrusted HTML', () => {
    const wrapper = mount(MarkdownContent, {
      props: { content: '**Summary**\n\n- Result\n\n<script>alert(1)</script>\n[unsafe](javascript:alert(1))' }
    })

    expect(wrapper.get('strong').text()).toBe('Summary')
    expect(wrapper.get('li').text()).toBe('Result')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.get('a').attributes('href')).toBeUndefined()
  })
})
