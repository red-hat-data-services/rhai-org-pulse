# Google Drive Integration - Quick Start

This guide shows you how to enable Google Drive file picking for Customer Insights.

## What This Does

Users can authenticate with their own Google account and:
- Browse their Google Drive files
- Select Google Sheets, CSV, or Google Docs
- Import them directly into Customer Insights
- No need to download/upload manually

## Setup Steps

### 1. Google Cloud Console Setup (5 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project or use existing
3. **Enable APIs**:
   - Navigate to **APIs & Services** → **Library**
   - Search and enable: **Google Drive API**
   - Search and enable: **Google Picker API**

4. **Create OAuth 2.0 Credentials**:
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - If prompted, configure OAuth consent screen first:
     - User Type: External (for any Google user)
     - App name: "Org Pulse"
     - Add scope: `https://www.googleapis.com/auth/drive.readonly`
   - Application type: **Web application**
   - Name: "Org Pulse Web Client"
   - **Authorized JavaScript origins**:
     - `http://localhost:5173`
     - Your production URL (e.g., `https://team-tracker.apps.example.com`)
   - **Authorized redirect URIs**:
     - `http://localhost:5173/api/modules/customer-insights/auth/google/callback`
     - `https://your-domain/api/modules/customer-insights/auth/google/callback`
   - Click **Create**
   - **Copy the Client ID and Client Secret**

5. **Create API Key** (for Picker):
   - Still in **Credentials**, click **Create Credentials** → **API Key**
   - **Copy the API Key**
   - (Optional) Restrict it:
     - Click on key → **Application restrictions** → **HTTP referrers**
     - Add: `http://localhost:5173/*` and your production domain

### 2. Configure Environment Variables

Add to `.env.local` (local dev) or deployment secrets (production):

```bash
# Google Drive OAuth - per-user authentication
GOOGLE_OAUTH_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
GOOGLE_PICKER_API_KEY=AIzaSyXXXXXXXXXXXXXXXXX

# Frontend also needs the Picker API key
VITE_GOOGLE_PICKER_API_KEY=AIzaSyXXXXXXXXXXXXXXXXX
```

**Important**: The Picker API Key needs to be exposed to the frontend via `VITE_` prefix.

### 3. Enable Sessions in Backend

The backend needs session support to store OAuth tokens. Add to `server/dev-server.js`:

```javascript
const session = require('express-session')

// Add before routes
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}))
```

Install express-session if not already installed:
```bash
npm install express-session
```

### 4. Test It

1. Start dev server: `npm run dev:full`
2. Navigate to: **Customer Insights** → **Import** → **Google Drive Import** tab
3. Click **Connect Google Drive**
4. Authenticate with your Google account
5. Grant Drive read-only access
6. Popup closes, you see "Connected to Google Drive"
7. Click **Pick File from Drive**
8. Google Picker opens → select a file
9. File is downloaded and processed

## How It Works

```
User Browser                Backend                 Google
     |                         |                       |
     |--Connect Google Drive-->|                       |
     |                         |--OAuth Request------->|
     |                         |                       |
     |<-----OAuth popup--------|                       |
     |                         |                       |
     |----User Authenticates------------------>       |
     |                         |                       |
     |<----Auth Code-----------+<----Auth Code--------|
     |                         |                       |
     |                         |--Exchange Code------->|
     |                         |<--Access Token--------|
     |                         |                       |
     |<--Connected!------------|                       |
     |                         |                       |
     |--Pick File------------->|                       |
     |                         |                       |
     |<--Google Picker---------|                       |
     |                         |                       |
     |--File Selected--------->|                       |
     |                         |--Download File------->|
     |                         |<--File Content--------|
     |                         |                       |
     |<--Processed Data--------|                       |
```

## Security Notes

- **Per-user OAuth**: Each user authenticates with their own Google account
- **Read-only access**: Scope is `drive.readonly` (cannot modify files)
- **Session-based tokens**: Access tokens stored in HTTP-only cookies
- **CSRF protection**: State parameter validates OAuth callback
- **Token refresh**: Refresh tokens automatically renew expired access tokens

## Troubleshooting

### "OAuth credentials not configured"
- Check `.env.local` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`
- Restart dev server after adding env vars

### "Redirect URI mismatch"
- Ensure redirect URI in Google Console matches exactly:
  - `http://localhost:5173/api/modules/customer-insights/auth/google/callback`
- No trailing slashes
- Protocol must match (http vs https)

### "Google Picker not loading"
- Check `.env.local` has `VITE_GOOGLE_PICKER_API_KEY`
- API key must be prefixed with `VITE_` for frontend access
- Restart Vite dev server (`npm run dev`)

### "Origin not allowed"
- Add your origin to **Authorized JavaScript origins** in Google Console
- Local: `http://localhost:5173`
- Production: Your full domain URL

## Production Deployment

1. Add secrets to deployment environment (Kubernetes, env vars, etc.)
2. Update **Authorized JavaScript origins** with production URL
3. Update **Authorized redirect URIs** with production callback URL
4. Set `SESSION_SECRET` to a secure random string
5. Ensure `cookie.secure: true` in session config (HTTPS only)

## Next Steps

- See `docs/GOOGLE-DRIVE-INTEGRATION.md` for architecture details
- Implement column mapping UI for Sheets
- Add progress indicators for large file downloads
- Cache user tokens in Redis for multi-server deployments
