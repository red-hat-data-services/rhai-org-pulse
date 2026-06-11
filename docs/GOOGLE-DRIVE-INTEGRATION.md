# Google Drive Integration Setup

## Overview

This guide shows how to set up OAuth 2.0 for Google Drive file picking, allowing users to authenticate with their own Google accounts and select files from their Drive.

## Google Cloud Console Setup

### 1. Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable APIs:
   - Go to **APIs & Services** → **Library**
   - Enable **Google Drive API**
   - Enable **Google Picker API**
4. Create OAuth consent screen:
   - Go to **APIs & Services** → **OAuth consent screen**
   - User Type: **External** (for any Google user) or **Internal** (Red Hat only)
   - App name: "Org Pulse Customer Insights"
   - User support email: your email
   - Scopes: Add `https://www.googleapis.com/auth/drive.readonly`
   - Test users: Add your email (if in testing mode)
5. Create OAuth 2.0 Client ID:
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: "Org Pulse Web Client"
   - Authorized JavaScript origins:
     - `http://localhost:5173` (local dev)
     - `https://your-production-domain.com` (production)
   - Authorized redirect URIs:
     - `http://localhost:5173/api/modules/customer-insights/auth/google/callback`
     - `https://your-production-domain.com/api/modules/customer-insights/auth/google/callback`
   - Click **Create**
   - **Save the Client ID and Client Secret**

### 2. Get Google Picker API Key

1. In Google Cloud Console → **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **API Key**
3. **Save the API Key**
4. (Optional) Restrict the key:
   - Click on the key → **Application restrictions** → **HTTP referrers**
   - Add your domains

## Environment Variables

Add to `.env` and `.env.local`:

```bash
# Google Drive OAuth (per-user authentication)
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_PICKER_API_KEY=your-api-key

# Callback URL (auto-constructed in production)
GOOGLE_OAUTH_CALLBACK_URL=http://localhost:5173/api/modules/customer-insights/auth/google/callback
```

## OAuth Flow Architecture

### Frontend Flow

1. User clicks "Connect Google Drive"
2. Popup window opens to `/api/modules/customer-insights/auth/google`
3. User authenticates with Google
4. Google redirects to callback URL with auth code
5. Backend exchanges code for access token
6. Access token stored in session/cookie
7. Popup closes, main window receives message
8. User clicks file picker → Google Picker API opens
9. User selects file → Drive API downloads content

### Backend Flow

- `GET /api/modules/customer-insights/auth/google` - Initiates OAuth
- `GET /api/modules/customer-insights/auth/google/callback` - Handles OAuth callback
- `POST /api/modules/customer-insights/drive/files/:fileId` - Downloads file content

### Security Notes

- **Per-user tokens**: Each user authenticates with their own Google account
- **Token storage**: Access tokens stored in HTTP-only cookies (not localStorage)
- **Token refresh**: Refresh tokens used to renew expired access tokens
- **Scope**: Read-only access to Drive (`drive.readonly`)
- **CSRF protection**: State parameter validates callback

## Implementation Files

- `modules/customer-insights/server/routes/googleAuth.js` - OAuth endpoints
- `modules/customer-insights/client/composables/useGoogleDrive.js` - Frontend OAuth helper
- `modules/customer-insights/client/components/GoogleDrivePicker.vue` - File picker UI

## Testing Locally

1. Set environment variables in `.env.local`
2. Start dev server: `npm run dev:full`
3. Navigate to Customer Insights → Import → Google Drive
4. Click "Connect Google Drive" → authenticate
5. Click "Pick Files" → select file from your Drive
6. File content is downloaded and processed
