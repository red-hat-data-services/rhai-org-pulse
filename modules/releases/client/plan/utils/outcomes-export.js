import { escapeCell, escapeCsv, triggerDownload } from './health-export'

/**
 * Export the active tab data as Markdown.
 *
 * @param {Object} opts
 * @param {string} opts.activeTab - 'big-rocks' | 'features' | 'rfes'
 * @param {string} opts.selectedVersion
 * @param {Array}  opts.bigRocks
 * @param {Array}  opts.filteredFeatures
 * @param {Array}  opts.filteredRfes
 */
export function exportMarkdown({ activeTab, selectedVersion, bigRocks, filteredFeatures, filteredRfes }) {
  var lines = []
  var filename

  if (activeTab === 'big-rocks') {
    lines.push('# Big Rocks - ' + selectedVersion)
    lines.push('')
    lines.push('| **Priority** | **Pillar** | **Big Rock** | **Owner** | **Engineering Lead** | **Features** | **RFEs** | **Notes** |')
    lines.push('|:--------:|--------|----------|-------|-----------|:--------:|:----:|-------|')
    for (var i = 0; i < bigRocks.length; i++) {
      var rock = bigRocks[i]
      lines.push('| ' + [
        rock.priority,
        escapeCell(rock.pillar || '-'),
        escapeCell(rock.name),
        escapeCell(rock.owner || '-'),
        escapeCell(rock.architect || '-'),
        rock.featureCount,
        rock.rfeCount,
        escapeCell(rock.notes || '-')
      ].join(' | ') + ' |')
    }
    filename = 'big-rocks-' + selectedVersion + '.md'
  } else if (activeTab === 'features') {
    lines.push('# Features - ' + selectedVersion)
    lines.push('')
    lines.push('| **Big Rock** | **Feature** | **Status** | **Priority** | **Phase** | **Title** | **Components** | **Target Release** | **PM** | **Delivery Owner** | **RFE** | **Fix Version** |')
    lines.push('|----------|---------|--------|----------|-------|-------|------------|----------------|-----|----------------|-----|-------------|')
    for (var j = 0; j < filteredFeatures.length; j++) {
      var f = filteredFeatures[j]
      lines.push('| ' + [
        escapeCell(f.bigRock || '-'),
        f.issueKey,
        escapeCell(f.status || '-'),
        escapeCell(f.priority || '-'),
        escapeCell(f.phase || '-'),
        escapeCell(f.summary || '-'),
        escapeCell(f.components || '-'),
        escapeCell(f.targetRelease || '-'),
        escapeCell(f.pm || '-'),
        escapeCell(f.deliveryOwner || '-'),
        f.rfe || '-',
        escapeCell(f.fixVersion || '-')
      ].join(' | ') + ' |')
    }
    filename = 'features-' + selectedVersion + '.md'
  } else {
    lines.push('# RFEs - ' + selectedVersion)
    lines.push('')
    lines.push('| **Big Rock** | **RFE** | **Status** | **Priority** | **Title** | **Components** | **PM** | **Labels** |')
    lines.push('|----------|-----|--------|----------|-------|------------|-----|--------|')
    for (var k = 0; k < filteredRfes.length; k++) {
      var r = filteredRfes[k]
      lines.push('| ' + [
        escapeCell(r.bigRock || '-'),
        r.issueKey,
        escapeCell(r.status || '-'),
        escapeCell(r.priority || '-'),
        escapeCell(r.summary || '-'),
        escapeCell(r.components || '-'),
        escapeCell(r.pm || '-'),
        escapeCell(r.labels || '-')
      ].join(' | ') + ' |')
    }
    filename = 'rfes-' + selectedVersion + '.md'
  }

  var blob = new Blob([lines.join('\n') + '\n'], { type: 'text/markdown' })
  triggerDownload(blob, filename)
}

/**
 * Export the active tab data as CSV.
 *
 * @param {Object} opts
 * @param {string} opts.activeTab - 'big-rocks' | 'features' | 'rfes'
 * @param {string} opts.selectedVersion
 * @param {Array}  opts.bigRocks
 * @param {Array}  opts.filteredFeatures
 * @param {Array}  opts.filteredRfes
 */
export function exportCsv({ activeTab, selectedVersion, bigRocks, filteredFeatures, filteredRfes }) {
  var rows = []
  var filename

  if (activeTab === 'big-rocks') {
    rows.push(['Priority', 'Pillar', 'Big Rock', 'Owner', 'Engineering Lead', 'Features', 'RFEs', 'Notes'])
    for (var i = 0; i < bigRocks.length; i++) {
      var rock = bigRocks[i]
      rows.push([
        rock.priority,
        rock.pillar || '',
        rock.name,
        rock.owner || '',
        rock.architect || '',
        rock.featureCount,
        rock.rfeCount,
        rock.notes || ''
      ])
    }
    filename = 'big-rocks-' + selectedVersion + '.csv'
  } else if (activeTab === 'features') {
    rows.push(['Big Rock', 'Feature', 'Status', 'Priority', 'Phase', 'Title', 'Components', 'Target Release', 'PM', 'Delivery Owner', 'RFE', 'Fix Version'])
    for (var j = 0; j < filteredFeatures.length; j++) {
      var f = filteredFeatures[j]
      rows.push([
        f.bigRock || '',
        f.issueKey,
        f.status || '',
        f.priority || '',
        f.phase || '',
        f.summary || '',
        f.components || '',
        f.targetRelease || '',
        f.pm || '',
        f.deliveryOwner || '',
        f.rfe || '',
        f.fixVersion || ''
      ])
    }
    filename = 'features-' + selectedVersion + '.csv'
  } else {
    rows.push(['Big Rock', 'RFE', 'Status', 'Priority', 'Title', 'Components', 'PM', 'Labels'])
    for (var k = 0; k < filteredRfes.length; k++) {
      var r = filteredRfes[k]
      rows.push([
        r.bigRock || '',
        r.issueKey,
        r.status || '',
        r.priority || '',
        r.summary || '',
        r.components || '',
        r.pm || '',
        r.labels || ''
      ])
    }
    filename = 'rfes-' + selectedVersion + '.csv'
  }

  var csv = rows.map(function(row) { return row.map(escapeCsv).join(',') }).join('\n')
  var blob = new Blob([csv + '\n'], { type: 'text/csv' })
  triggerDownload(blob, filename)
}
