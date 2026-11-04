// Map a failed request-form submission onto field errors and a banner.

export function describeSubmitError(err, fallbackLabel = 'request') {
  const data = (err && err.data) || {}
  if (err && err.status === 422 && data.fields) {
    return { fields: data.fields, banner: data.error || 'Validation failed. Check the highlighted fields.' }
  }
  if (err && err.status === 429) {
    const wait = data.retry_after_seconds
      ? ` Please try again in about ${data.retry_after_seconds} seconds.`
      : ''
    return { banner: (data.error || err.message || 'Rate limited') + wait }
  }
  if (err && (err.status === 502 || err.status === 503)) {
    return {
      banner: (data.error || err.message || 'Upstream error') +
        ' Please check the Product Builds configuration or try again later.'
    }
  }
  const text = (err && err.message) ? err.message : `Failed to submit ${fallbackLabel}`
  return {
    banner: err && err.status
      ? text
      : `Could not reach the server (${text}). Check your connection and try again.`
  }
}
