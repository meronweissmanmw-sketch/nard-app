# Nard App — דוח פיקוח הנדסי

A React Native / Expo app for creating engineering inspection reports.

---

## 🚀 Quick Start — Run the app in 3 steps

> **Prerequisites:** Install [Node.js LTS](https://nodejs.org) (v20 or later) once on your machine.

```bash
# 1. Clone this repository
git clone https://github.com/meronweissmanmw-sketch/nard-app.git
cd nard-app

# 2. Install dependencies
npm install

# 3. Start the development server
npx expo start
```

Then:
- **On your phone** — install the **Expo Go** app ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iPhone](https://apps.apple.com/app/expo-go/id982107779)) and scan the QR code.
- **On Android emulator** — press `a` in the terminal (requires Android Studio).
- **On iOS simulator (Mac only)** — press `i` in the terminal (requires Xcode).

---

## 📁 Project structure

```
nard-app/                    ← repo root — open this folder in VS Code / terminal
├── Nard.slnx               Visual Studio solution (open this in VS 2026)
├── nard.esproj             Visual Studio JS project file
├── package.json            npm dependencies
├── app.json                Expo configuration
├── eas.json                EAS Build profiles (preview / production) and submit config
├── tsconfig.json           TypeScript configuration
├── babel.config.js         Babel configuration
├── ProjectContext.tsx      Shared state (projects, createNewProject, addProjectItem)
├── assets/                 App icons and splash screen
└── app/                    All screens (expo-router file-based routing)
    ├── _layout.tsx         Root navigation layout
    ├── index.tsx           Home — list of all projects
    ├── new-project.tsx     Create a project (buildings / floors / parking)
    ├── project-details.tsx Project detail — list reports, export Word doc
    ├── editor.tsx          Walk Mode — capture defects floor by floor
    ├── review.tsx          Review Mode — read and edit all captured defects
    ├── camera.tsx          Full-screen camera for photographing defects
    ├── modal.tsx           Quick "new report" modal
    └── settings.tsx        App settings (default subject, notes, logo)
```

---

## 🖥️ Opening in Visual Studio 2026

1. Double-click **`Nard.slnx`** — Visual Studio opens the solution.
2. The project is already configured to run `npx expo start` when you press **F5**.
3. GitHub Copilot works inline in every file — type code and press **Tab** to accept suggestions, **Esc** to reject.

---

## 💻 Opening in VS Code (same Copilot experience as VS 2026)

```bash
# Open the repo root in VS Code
cd nard-app
code .
```

### Install GitHub Copilot in VS Code

1. Press `Ctrl+Shift+X` → search **"GitHub Copilot"** → Install.
2. Also install **"GitHub Copilot Chat"**.
3. Click the **Accounts** icon (bottom-left) → "Sign in with GitHub to use GitHub Copilot".

### Copilot keyboard shortcuts (identical to VS 2026)

| Action | Shortcut |
|---|---|
| **Accept** suggestion | `Tab` |
| **Reject** suggestion | `Esc` |
| Next suggestion | `Alt` + `]` |
| Previous suggestion | `Alt` + `[` |
| Edit selected code inline | `Ctrl` + `I` |
| Open Copilot Chat | `Ctrl` + `Alt` + `I` |

---

## 📦 Building a standalone app (APK / IPA)

Nard App uses **Expo Application Services (EAS)** to produce installable binaries without needing Xcode or Android Studio locally.

### One-time setup

```bash
# 1. Install EAS CLI globally
npm install -g eas-cli

# 2. Create a free Expo account at https://expo.dev/signup  (skip if you already have one)

# 3. Log in
eas login

# 4. Link this project to your Expo account (run once inside the repo)
eas build:configure
```

### Build profiles (defined in `eas.json`)

| Profile | Purpose | Output |
|---|---|---|
| `preview` | Share with testers directly (no store needed) | `.apk` (Android) / ad-hoc `.ipa` (iOS) |
| `production` | Submit to Google Play / App Store | `.aab` (Android) / `.ipa` (iOS) |

### Build commands

```bash
# Android APK ready to install on any device — share the download link with testers
npm run build:android:preview
# or: eas build --platform android --profile preview

# iOS build for testers (requires Apple Developer account, $99/yr)
npm run build:ios:preview
# or: eas build --platform ios --profile preview

# Production builds (for store submission)
npm run build:android:prod
npm run build:ios:prod

# Build both platforms at once
npm run build:all
```

After the build finishes, EAS prints a URL. Download the `.apk` / `.ipa` and:
- **Android APK** → send the file to testers; they enable *Install from unknown sources* and install it.
- **iOS IPA** → install via TestFlight (see below) or Apple Configurator 2.

---

## 🌍 Distributing to the world (App Stores)

### Google Play Store (Android)

1. Create a [Google Play Console](https://play.google.com/console) account (one-time $25 fee).
2. Create a new app in the Console — choose "App" → "Android App" → fill in details.
3. Generate a **Service Account** key (JSON) with *Release Manager* permissions and save it as `google-service-account.json` in the project root directory (**never commit this file — it is already in `.gitignore`**).
4. Update `eas.json` → `submit.production.android.serviceAccountKeyPath` with the correct path.
   > **CI/CD alternative:** store the key contents as an EAS Secret instead of a local file:
   > ```bash
   > eas secret:create --scope project --name GOOGLE_SERVICE_ACCOUNT_KEY --value "$(cat google-service-account.json)"
   > ```
5. Run:
   ```bash
   npm run build:android:prod   # builds a signed .aab
   npm run submit:android       # uploads to Play Store internal track
   ```
6. In Play Console → promote the release from *Internal* → *Closed testing* → *Open testing* → *Production*.

### Apple App Store (iOS)

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/yr).
2. Create an App record in [App Store Connect](https://appstoreconnect.apple.com).
3. Fill in `eas.json` → `submit.production.ios` with your `appleId`, `ascAppId`, and `appleTeamId`.
   > **CI/CD alternative:** store credentials as EAS Secrets to avoid keeping them in the file:
   > ```bash
   > eas secret:create --scope project --name EXPO_APPLE_ID --value "your@apple.id"
   > eas secret:create --scope project --name EXPO_ASC_APP_ID --value "1234567890"
   > ```
4. Run:
   ```bash
   npm run build:ios:prod   # builds a signed .ipa
   npm run submit:ios       # uploads to App Store Connect
   ```
5. In App Store Connect → add the build to **TestFlight** for beta testing, then submit for App Review.

### TestFlight (iOS beta testing — no store review needed)

1. Upload a production or preview build (`npm run submit:ios` or `eas submit --platform ios --profile production`).
2. In App Store Connect → TestFlight → add internal testers by email.
3. Testers install the **TestFlight** app from the App Store and accept the invite.

### Expo Web (instant — no stores)

```bash
# Export a static web build
npx expo export --platform web

# The output is in dist/  — deploy to any static host, e.g.:
npx serve dist/                        # local preview
# or upload dist/ to Netlify / Vercel / GitHub Pages
```

---

## 🗂 Data model

All data is stored locally on the device using `AsyncStorage` under the key `'projects'`.

```typescript
interface Project {
    id: string;
    name: string;
    startDate: string;
    structure: {
        buildings: { id: string; name: string; floors: number }[];
        parkings:  { id: string; name: string; floors: number }[];
        development?: { areas: { id: string; name: string }[] } | null;
    };
    reports: Report[];
}

interface Report {
    id: string;
    subject: string;
    date: string;
    initialNotes: string;
    finalNotes: string;
    items: Item[];
}

interface Item {
    id: string;
    location: string;
    notes: string;
    assignedTo: string;
    images: string[]; // local file URIs
}
```
