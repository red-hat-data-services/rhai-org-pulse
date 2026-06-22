import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatGuideView from '../views/ChatGuideView.vue'

describe('ChatGuideView', () => {
  let wrapper

  beforeEach(() => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    })
    wrapper = mount(ChatGuideView)
  })

  it('renders the main heading', () => {
    expect(wrapper.find('h1').text()).toBe('Chat with Your Data')
  })

  it('displays quick start steps', () => {
    const steps = wrapper.findAll('ol li')
    expect(steps.length).toBeGreaterThanOrEqual(3)
    expect(steps[0].text()).toContain('Install Claude Desktop')
    expect(steps[1].text()).toContain('Configure the MCP server')
    expect(steps[2].text()).toContain('Start chatting')
  })

  it('shows setup instructions with config paths', () => {
    const headings = wrapper.findAll('h3')
    const setupHeadings = headings.filter(h => h.text().includes('Config File'))
    expect(setupHeadings.length).toBeGreaterThan(0)

    // Verify both macOS and Windows paths are shown
    expect(wrapper.text()).toContain('~/Library/Application Support/Claude/claude_desktop_config.json')
    expect(wrapper.text()).toContain('%APPDATA%/Claude/claude_desktop_config.json')
  })

  it('displays MCP server configuration JSON', () => {
    const codeBlocks = wrapper.findAll('pre code')
    expect(codeBlocks.length).toBeGreaterThan(0)
    expect(codeBlocks[0].text()).toContain('mcpServers')
    expect(codeBlocks[0].text()).toContain('org-pulse')
    expect(codeBlocks[0].text()).toContain('mcp-server.mjs')
  })

  it('shows example questions for customer insights', () => {
    expect(wrapper.text()).toContain('What are the top pain points')
    expect(wrapper.text()).toContain('customer feedback')
  })

  it('shows example questions for team data', () => {
    expect(wrapper.text()).toContain('Show me the team roster')
    expect(wrapper.text()).toContain('Jira metrics')
  })

  it('lists available MCP tools', () => {
    expect(wrapper.text()).toContain('get_team_roster')
    expect(wrapper.text()).toContain('get_person_metrics')
    expect(wrapper.text()).toContain('get_team_snapshot')
    expect(wrapper.text()).toContain('get_github_contributions')
    expect(wrapper.text()).toContain('get_gitlab_contributions')
    expect(wrapper.text()).toContain('get_feature_data')
    expect(wrapper.text()).toContain('get_messages')
    expect(wrapper.text()).toContain('get_site_config')
  })

  it('includes troubleshooting section', () => {
    expect(wrapper.text()).toContain('Troubleshooting')
    expect(wrapper.text()).toContain('Server not showing up')
    expect(wrapper.text()).toContain('Data not found')
  })

  it('displays security notice', () => {
    expect(wrapper.text()).toContain('Security & Privacy')
    expect(wrapper.text()).toContain('locally only')
    expect(wrapper.text()).toContain('read-only')
  })

  it('has a copy button for config', async () => {
    const copyButton = wrapper.find('button')
    expect(copyButton.text()).toBe('Copy')

    await copyButton.trigger('click')
    expect(navigator.clipboard.writeText).toHaveBeenCalled()
    expect(copyButton.text()).toBe('Copied!')

    // Wait for reset (2 seconds in component)
    await new Promise(resolve => setTimeout(resolve, 2100))
    expect(copyButton.text()).toBe('Copy')
  })

  it('shows example use cases in grid layout', () => {
    // Should have multiple example categories
    expect(wrapper.text()).toContain('Customer Insights')
    expect(wrapper.text()).toContain('Team & People Data')
    expect(wrapper.text()).toContain('Custom Analysis')
    expect(wrapper.text()).toContain('Releases & Features')
  })
})
