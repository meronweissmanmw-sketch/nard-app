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

```bash
# Install EAS CLI once
npm install -g eas-cli

# Log in (free Expo account)
eas login

# Configure once
eas build:configure

# Build an Android APK for direct install
eas build --platform android --profile preview

# Build for iOS (requires Apple Developer account)
eas build --platform ios
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
