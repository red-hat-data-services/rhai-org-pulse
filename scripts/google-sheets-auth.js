#!/usr/bin/env node
/**
 * Google Sheets OAuth authentication helper
 * Run this once to generate the OAuth token for Customer Insights Google Sheets integration
 */

const { google } = require('googleapis')
const http = require('http')
const url = require('url')
const fs = require('fs').promises
const path = require('path')
require('dotenv').config()

const TOKEN_PATH = path.join(__dirname, '..', 'data', 'customer-insights-google-token.json')
const REDIRECT_URI = 'http://localhost:3456/callback'

async function authenticate() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env file')
    process.exit(1)
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    REDIRECT_URI
  )

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly'
    ],
    prompt: 'consent' // Force to get refresh token
  })

  console.log('\n📋 Customer Insights - Google Sheets Authentication\n')
  console.log('1. Open this URL in your browser:\n')
  console.log(`   ${authUrl}\n`)
  console.log('2. Authorize the application')
  console.log('3. You will be redirected to localhost:3456/callback')
  console.log('4. The token will be saved automatically\n')
  console.log('Starting callback server on http://localhost:3456...\n')

  // Start temporary server to receive callback
  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = url.parse(req.url, true)

      if (parsedUrl.pathname === '/callback') {
        const code = parsedUrl.query.code

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end('<h1>Error: No authorization code received</h1>')
          return
        }

        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code)

        // Save token
        await fs.mkdir(path.dirname(TOKEN_PATH), { recursive: true })
        await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2))

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
          <html>
            <body style="font-family: system-ui; padding: 2rem; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #16a34a;">✅ Authentication Successful!</h1>
              <p>Token saved to: <code>${TOKEN_PATH}</code></p>
              <p>You can close this window and return to the terminal.</p>
              <p><strong>Next step:</strong> Restart your dev server to use Google Sheets integration.</p>
            </body>
          </html>
        `)

        console.log('\n✅ Success! Token saved to:', TOKEN_PATH)
        console.log('\n🔄 Restart your dev server to use Google Sheets integration.\n')

        // Close server after 2 seconds
        setTimeout(() => {
          server.close()
          process.exit(0)
        }, 2000)
      }
    } catch (error) {
      console.error('❌ Error during authentication:', error.message)
      res.writeHead(500, { 'Content-Type': 'text/html' })
      res.end(`<h1>Error: ${error.message}</h1>`)
      server.close()
      process.exit(1)
    }
  })

  server.listen(3456, () => {
    console.log('Waiting for authorization...\n')
  })
}

authenticate().catch(err => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
