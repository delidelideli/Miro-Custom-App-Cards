# Match It or Fake It — Setup Guide

Step-by-step instructions for getting the project running on a new machine.

---

## Prerequisites

Install these before starting:

- [Node.js](https://nodejs.org) v20 or higher (v24 recommended)
- [Git](https://git-scm.com)
- [Vercel CLI](https://vercel.com/docs/cli): `npm install -g vercel`

---

## 1. Clone the repo

```bash
git clone https://github.com/delidelideli/Miro-Custom-App-Cards.git
cd Miro-Custom-App-Cards
npm install
```

---

## 2. Miro developer portal

1. Go to [miro.com/app/settings/user-profile/apps](https://miro.com/app/settings/user-profile/apps)
2. Open the **Match It or Fake It** app
3. Note your **Client ID** and **Client Secret** — you'll need the secret for `.env.local`
4. Make sure these permissions are enabled: `boards:read`, `boards:write`, `identity:read`
5. App URL should be `http://localhost:3000` for local dev
6. Make sure you are a member of the developer team the app is installed to

---

## 3. Firebase

You need access to the **mirocardgame** Firebase project.

Ask the project owner (Connor) to add your Google account as an Editor in:
Firebase Console → Project Settings → Users and permissions

Once you have access:

**Get the service account key:**
1. Firebase Console → Project Settings → Service accounts
2. Click "Generate new private key" → download the JSON file
3. In a terminal in the project folder, run:
   ```
   node -e "console.log(JSON.stringify(require('./YOUR-DOWNLOADED-FILE.json')))"
   ```
4. Copy the entire output (one long line starting with `{`)
5. Delete the downloaded JSON file — never leave it in the project folder

**Get the web config:**
1. Firebase Console → Project Settings → Your apps → the web app (`</>`)
2. Choose "Config" to see the `firebaseConfig` object
3. You'll need `apiKey`, `authDomain`, `projectId`, and `appId`

---

## 4. Create your `.env.local` file

Create a file called `.env.local` in the project root (never commit this file — it's in `.gitignore`):

```
MIRO_CLIENT_SECRET=paste_client_secret_here
FIREBASE_SERVICE_ACCOUNT=paste_full_json_line_here
VITE_FIREBASE_API_KEY=paste_from_firebase_config
VITE_FIREBASE_AUTH_DOMAIN=paste_from_firebase_config
VITE_FIREBASE_PROJECT_ID=mirocardgame
VITE_FIREBASE_APP_ID=paste_from_firebase_config
```

**Important:** The `FIREBASE_SERVICE_ACCOUNT` value must be all on one line with no line breaks.

---

## 5. Link to Vercel

```bash
vercel login      # sign in with GitHub
vercel link       # connect to the existing miro-game-mod project
```

When `vercel link` asks, choose "Link to existing project" and select **miro-game-mod**.

---

## 6. Run locally

```bash
npm run dev
```

This starts two servers:
- Vite frontend on `http://localhost:3000`
- Express API server on `http://localhost:3001` (proxied through 3000)

Open your Miro test board, click the app icon in the toolbar, and the panel should open.

---

## 7. Firestore security rules

If you're setting up a brand-new Firebase project (not needed for the existing one):

1. Firebase Console → Firestore Database → Rules tab
2. Paste the contents of `firestore.rules` and click Publish

---

## Notes

- The Miro App URL in the developer portal must be `http://localhost:3000` for local dev and the Vercel deployment URL for production
- Everyone testing must be a member of the Miro developer team where the app is installed
- Do not share `.env.local`, service account JSON files, or any credentials in chat or git
