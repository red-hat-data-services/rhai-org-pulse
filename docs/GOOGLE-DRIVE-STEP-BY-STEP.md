# Google Drive Integration - Step by Step

## What You'll Do

1. Get Google Cloud credentials (10 mins)
2. Add credentials to `.env.local` (2 mins)
3. Add session support to backend (5 mins)
4. Test it! (2 mins)

---

## Step 1: Get Google Credentials ✅

**Follow:** `/Users/ankristo/pulse/docs/GOOGLE-CLOUD-SETUP-WALKTHROUGH.md`

You should end up with three values:
```
GOOGLE_OAUTH_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
GOOGLE_PICKER_API_KEY=AIzaSyXXXXXXXXXXXXXXXXX
```

**Let me know when you have these!** Then we'll continue to Step 2.

---

## Step 2: Add Credentials to .env.local

Once you have your credentials, add them to `/Users/ankristo/pulse/.env.local`:

```bash
# Add these lines to the end of .env.local:

# Google Drive OAuth (per-user authentication)
GOOGLE_OAUTH_CLIENT_ID=paste-your-client-id-here
GOOGLE_OAUTH_CLIENT_SECRET=paste-your-client-secret-here
GOOGLE_PICKER_API_KEY=paste-your-api-key-here

# Frontend needs the API key too
VITE_GOOGLE_PICKER_API_KEY=paste-your-api-key-here
```

**Important:** 
- Use the SAME API key for both `GOOGLE_PICKER_API_KEY` and `VITE_GOOGLE_PICKER_API_KEY`
- Don't add quotes around the values
- No spaces around the `=` sign

---

## Step 3: Install express-session

```bash
cd /Users/ankristo/pulse
npm install express-session
```

---

## Step 4: Add Session Middleware to Backend

Edit `/Users/ankristo/pulse/server/dev-server.js`:

**Find this line (around line 176):**
```javascript
app.use(express.json({ limit: '10mb' }));
```

**Add this AFTER it:**
```javascript
// Session support for OAuth (Google Drive per-user auth)
const session = require('express-session');
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production-' + Date.now(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

**Save the file.**

---

## Step 5: Start the Server

```bash
npm run dev:full
```

You should see:
```
People & Teams dev server running at http://localhost:3001
```

---

## Step 6: Test It!

1. **Open:** http://localhost:5173
2. Navigate to: **Customer Insights** → **Import** → **Google Drive Import** tab
3. Click **"Connect Google Drive"**
4. A popup opens → Sign in with your Google account
5. Grant "Read-only Drive access"
6. Popup closes → You see "✓ Connected to Google Drive"
7. Click **"Pick File from Drive"**
8. Google Picker opens → Select a file (CSV, Google Sheets, or Google Doc)
9. File downloads and processes!

---

## Troubleshooting

### "OAuth credentials not configured"
- Check `.env.local` has the three Google variables
- Restart dev server: `Ctrl+C` then `npm run dev:full`

### "Redirect URI mismatch"
- In Google Cloud Console → Credentials → Your OAuth Client
- Make sure redirect URI is EXACTLY: `http://localhost:5173/api/modules/customer-insights/auth/google/callback`
- No trailing slash!

### "Session is not defined"
- Run: `npm install express-session`
- Restart server

### "Google Picker not loading"
- Check `.env.local` has `VITE_GOOGLE_PICKER_API_KEY`
- Restart FRONTEND: `npm run dev` (in separate terminal)

---

## What's Next?

Once this works locally, we'll set up **per-user Jira OAuth** so RFEs are created as the actual user, not a shared account!

---

## Security Reminder

✅ **Your Google Drive is private** - each user authenticates with their own account  
✅ **Tokens are secure** - stored in HTTP-only cookies  
✅ **Read-only** - can't modify your Drive files  
