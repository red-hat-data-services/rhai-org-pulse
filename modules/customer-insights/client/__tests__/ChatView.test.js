import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatView from '../views/ChatView.vue'

describe('ChatView', () => {
  let wrapper

  beforeEach(() => {
    // Mock fetch for streaming responses
    global.fetch = vi.fn()
    wrapper = mount(ChatView)
  })

  it('renders the main heading', () => {
    expect(wrapper.find('h1').text()).toBe('AI Chat Assistant')
  })

  it('shows welcome message when no messages', () => {
    expect(wrapper.text()).toContain('What can I help you with?')
  })

  it('displays example prompts', () => {
    const buttons = wrapper.findAll('button').filter(b =>
      b.text().includes('pain points') ||
      b.text().includes('customer feedback') ||
      b.text().includes('ARR impact') ||
      b.text().includes('sentiment')
    )
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('has an input field for user messages', () => {
    const input = wrapper.find('input[type="text"]')
    expect(input.exists()).toBe(true)
    expect(input.attributes('placeholder')).toContain('Ask a question')
  })

  it('has a send button', () => {
    const sendButton = wrapper.findAll('button').find(b => b.text().includes('Send'))
    expect(sendButton).toBeDefined()
  })

  it('disables send button when input is empty', () => {
    const sendButton = wrapper.findAll('button').find(b => b.text().includes('Send'))
    expect(sendButton.attributes('disabled')).toBeDefined()
  })

  it('enables send button when input has text', async () => {
    const input = wrapper.find('input[type="text"]')
    await input.setValue('test message')
    await wrapper.vm.$nextTick()

    const sendButton = wrapper.findAll('button').find(b => b.text().includes('Send'))
    expect(sendButton.attributes('disabled')).toBeUndefined()
  })

  it('shows clear button when messages exist', async () => {
    // Add a message directly to the component
    wrapper.vm.messages = [{ role: 'user', content: 'test' }]
    await wrapper.vm.$nextTick()

    const clearButton = wrapper.findAll('button').find(b => b.text().includes('Clear'))
    expect(clearButton).toBeDefined()
  })

  it('does not show clear button when no messages', () => {
    const clearButton = wrapper.findAll('button').find(b => b.text().includes('Clear'))
    expect(clearButton).toBeUndefined()
  })

  it('shows configuration notice when not configured', async () => {
    wrapper.vm.configured = false
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Claude API Not Configured')
    expect(wrapper.text()).toContain('ANTHROPIC_API_KEY')
  })

  it('formats bold text in messages', () => {
    const formatted = wrapper.vm.formatMessage('This is **bold** text')
    expect(formatted).toContain('<strong>bold</strong>')
  })

  it('formats italic text in messages', () => {
    const formatted = wrapper.vm.formatMessage('This is *italic* text')
    expect(formatted).toContain('<em>italic</em>')
  })

  it('formats code in messages', () => {
    const formatted = wrapper.vm.formatMessage('This is `code` text')
    expect(formatted).toContain('<code')
    expect(formatted).toContain('code</code>')
  })

  it('formats bullet points in messages', () => {
    const formatted = wrapper.vm.formatMessage('- Item one\n- Item two')
    expect(formatted).toContain('<li>')
    expect(formatted).toContain('<ul')
  })

  it('disables input while typing', async () => {
    wrapper.vm.isTyping = true
    await wrapper.vm.$nextTick()

    const input = wrapper.find('input[type="text"]')
    expect(input.attributes('disabled')).toBeDefined()
  })

  it('shows user and assistant messages with different styles', async () => {
    wrapper.vm.messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ]
    await wrapper.vm.$nextTick()

    const bubbles = wrapper.findAll('[class*="rounded-lg"]')
    expect(bubbles.length).toBeGreaterThan(0)
  })

  it('displays "Powered by Claude AI" footer', () => {
    expect(wrapper.text()).toContain('Powered by Claude AI')
  })
})
