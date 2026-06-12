# Google Cloud Console Setup - Detailed Walkthrough

## Prerequisites

- A Google account (your Red Hat email or personal Gmail)
- 10-15 minutes

## Step 1: Create or Select Project

1. **Go to Google Cloud Console**
   - Navigate to: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create New Project (or select existing)**
   - Click the project dropdown in the top navigation bar (next to "Google Cloud")
   - Click **"NEW PROJECT"** button (top right of the popup)
   - Project name: `org-pulse` (or whatever you prefer)
   - Organization: Leave as "No organization" (unless you have a Red Hat org)
   - Click **"CREATE"**
   - Wait ~10 seconds for project creation
   - You'll be automatically switched to the new project

## Step 2: Enable Required APIs

### Enable Google Drive API

1. **Navigate to APIs & Services**
   - In the left sidebar, click **"APIs & Services"** → **"Library"**
   - Or use the search bar at top: type "Library" and select "API Library"

2. **Find Google Drive API**
   - In the search box (top of page), type: `Google Drive API`
   - Click on **"Google Drive API"** from the results

3. **Enable the API**
   - Click the blue **"ENABLE"** button
   - Wait ~5 seconds for enablement
   - You'll see "API enabled" confirmation

### Enable Google Picker API

1. **Go back to Library**
   - Click **"APIs & Services"** → **"Library"** in left sidebar again
   - Or click the back arrow

2. **Find Google Picker API**
   - Search: `Google Picker API`
   - Click on **"Google Picker API"**

3. **Enable the API**
   - Click **"ENABLE"**
   - Wait for confirmation

## Step 3: Configure OAuth Consent Screen

This screen is what users see when they authenticate.

1. **Navigate to OAuth Consent Screen**
   - Click **"APIs & Services"** → **"OAuth consent screen"** (left sidebar)

2. **Select User Type**
   - Choose **"External"** (allows any Google user to authenticate)
   - Click **"CREATE"**

3. **Fill in App Information (Page 1)**
   - **App name**: `Org Pulse Customer Insights`
   - **User support email**: Select your email from dropdown
   - **App logo**: (Optional) Skip for now
   - **App domain**: (Optional) Skip for now
   - **Authorized domains**: (Optional) For production, add your domain later
   - **Developer contact information**: Enter your email

   Click **"SAVE AND CONTINUE"**

4. **Scopes (Page 2)**
   - Click **"ADD OR REMOVE SCOPES"**
   - In the filter box, type: `drive.readonly`
   - Check the box next to:
     - `https://www.googleapis.com/auth/drive.readonly` 
     - Description: "See and download all your Google Drive files"
   - Click **"UPDATE"** at bottom
   - Click **"SAVE AND CONTINUE"**

5. **Test Users (Page 3)**
   - Click **"+ ADD USERS"**
   - Enter your email address (the one you'll test with)
   - Click **"ADD"**
   - Click **"SAVE AND CONTINUE"**

6. **Summary (Page 4)**
   - Review your settings
   - Click **"BACK TO DASHBOARD"**

## Step 4: Create OAuth 2.0 Client ID

This is for authenticating users.

1. **Navigate to Credentials**
   - Click **"APIs & Services"** → **"Credentials"** (left sidebar)

2. **Create OAuth Client ID**
   - Click **"+ CREATE CREDENTIALS"** (top of page)
   - Select **"OAuth client ID"**

3. **Configure OAuth Client**
   - **Application type**: Select **"Web application"**
   - **Name**: `Org Pulse Web Client`

   **Authorized JavaScript origins:**
   - Click **"+ ADD URI"**
   - Enter: `http://localhost:5173`
   - (For production later, you'll add: `https://your-domain.com`)

   **Authorized redirect URIs:**
   - Click **"+ ADD URI"**
   - Enter: `http://localhost:5173/api/modules/customer-insights/auth/google/callback`
   - (For production later: `https://your-domain.com/api/modules/customer-insights/auth/google/callback`)

   Click **"CREATE"**

4. **Copy Your Credentials**
   - A popup appears with your credentials
   - **Client ID**: Looks like `123456789-abc.apps.googleusercontent.com`
   - **Client Secret**: Looks like `GOCSPX-xxxxxxxxxxxxx`
   
   **IMPORTANT:** Copy these somewhere safe! You'll need them in the next step.
   
   Click **"OK"** to close the popup

5. **Save Credentials**
   - Open a text file or note app
   - Paste:
     ```
     GOOGLE_OAUTH_CLIENT_ID=<paste your client ID>
     GOOGLE_OAUTH_CLIENT_SECRET=<paste your client secret>
     ```

## Step 5: Create API Key (for Google Picker)

This key allows the frontend to display the file picker UI.

1. **Create API Key**
   - Still in **"Credentials"** page
   - Click **"+ CREATE CREDENTIALS"** (top of page)
   - Select **"API key"**

2. **Copy Your API Key**
   - A popup appears with your API key
   - Looks like: `AIzaSyXXXXXXXXXXXXXXXXX`
   - Click the **copy icon** to copy it
   - Click **"CLOSE"**

3. **Restrict the API Key (Recommended)**
   - Find your newly created key in the list (it's at the bottom)
   - Click the **pencil icon** (Edit) next to the key
   - Under **"API restrictions"**:
     - Select **"Restrict key"**
     - Click **"Select APIs"** dropdown
     - Check: **Google Drive API**
     - Check: **Google Picker API**
   - Under **"Application restrictions"** (optional but recommended):
     - Select **"HTTP referrers (web sites)"**
     - Click **"+ ADD AN ITEM"**
     - Enter: `http://localhost:5173/*`
     - (For production later: `https://your-domain.com/*`)
   - Click **"SAVE"**

4. **Save API Key**
   - Add to your notes:
     ```
     GOOGLE_PICKER_API_KEY=<paste your API key>
     ```

## Step 6: Your Final Credentials

You should now have three values:

```bash
GOOGLE_OAUTH_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
GOOGLE_PICKER_API_KEY=AIzaSyXXXXXXXXXXXXXXXXX
```

✅ **Step 1 Complete!** 

Keep these credentials safe - you'll add them to your `.env.local` file in the next step.

## Troubleshooting

### "OAuth consent screen is required"
- You must complete Step 3 (OAuth consent screen) before creating OAuth client ID

### Can't find APIs & Services menu
- Make sure you're in the correct project (check project dropdown at top)
- Try using the search bar at the very top: type "APIs & Services"

### "This app isn't verified" warning during testing
- This is normal for apps in testing mode
- Click "Advanced" → "Go to [App Name] (unsafe)" to proceed
- Only appears for external users outside your test users list
- Won't appear once you publish your app (or use internal user type)

### Lost my credentials
- **OAuth Client ID/Secret**: Go to Credentials → Find your web client → Click pencil icon → Credentials are shown
- **API Key**: Go to Credentials → Find your API key → Click "Show Key"

## Next Steps

Proceed to Step 2: Configure Environment Variables
