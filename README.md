# Nard App — דוח פיקוח הנדסי

A React Native / Expo app for engineering inspection reports (נארד — דוח פיקוח הנדסי).

---

## 📁 What's in this repository

| File | Purpose |
|---|---|
| `_layout.tsx` | Root navigation layout (expo-router Stack) |
| `index.tsx` | Home screen — list of all projects |
| `new-project.tsx` | Create a new project with buildings/floors/parking |
| `project-details.tsx` | Project detail screen — list reports, export to Word |
| `editor.tsx` | Walk Mode — walk the building and capture defects with the camera |
| `review.tsx` | Review Mode — read and edit all captured defects before export |
| `camera.tsx` | Full-screen camera for capturing defect photos |
| `modal.tsx` | Quick "new report" modal |
| `settings.tsx` | App settings (default subject, opening/closing notes) |

These are all **screen files only** — they do not include a full project scaffold. See the setup instructions below.

---

## 🚀 Setup: Running the App (Full Project Scaffold)

### Prerequisites

Install these once on your machine:

```bash
# 1. Node.js LTS (v20 or later)
#    Download from https://nodejs.org

# 2. Expo CLI
npm install -g expo-cli

# 3. EAS CLI (for building device-ready APKs/IPAs)
npm install -g eas-cli
```

### Step 1 — Create an Expo project

```bash
npx create-expo-app nard-app --template blank-typescript
cd nard-app
```

### Step 2 — Install all dependencies used by this app

```bash
npx expo install \
  expo-router \
  expo-camera \
  expo-image-picker \
  expo-file-system \
  expo-sharing \
  expo-image-manipulator \
  @react-native-async-storage/async-storage \
  @react-native-community/datetimepicker \
  @react-navigation/native \
  @react-navigation/native-stack \
  react-native-safe-area-context \
  react-native-screens \
  @expo/vector-icons \
  @react-native-picker/picker \
  docx \
  buffer
```

### Step 3 — Copy the screen files

Copy **all `.tsx` files from this repository** into the `app/` folder of your new Expo project:

```
nard-app/
  app/
    _layout.tsx       ← copy here
    index.tsx         ← copy here
    new-project.tsx   ← copy here
    project-details.tsx
    editor.tsx
    review.tsx
    camera.tsx
    modal.tsx
    settings.tsx
```

> **Note:** expo-router uses file-based routing — every `.tsx` file in `app/` automatically becomes a screen.

### Step 4 — Update `app.json`

Open `app.json` and set the following (replace the defaults):

```json
{
  "expo": {
    "name": "Nard App",
    "slug": "nard-app",
    "scheme": "nard-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "plugins": [
      "expo-router",
      "expo-camera",
      [
        "expo-image-picker",
        { "photosPermission": "Allow Nard to access your photos." }
      ]
    ],
    "android": {
      "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png" },
      "permissions": ["CAMERA", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE"]
    },
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "Used to photograph defects",
        "NSPhotoLibraryUsageDescription": "Used to attach defect photos"
      }
    }
  }
}
```

### Step 5 — Create `ProjectContext.tsx`

The layout imports a `ProjectContext`. Create `ProjectContext.tsx` at the root of your project (next to `package.json`):

```tsx
// ProjectContext.tsx
import React, { createContext, useContext, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ProjectContext = createContext<any>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const createNewProject = async (project: any) => {
    const data = await AsyncStorage.getItem('projects');
    const existing = data ? JSON.parse(data) : [];
    await AsyncStorage.setItem('projects', JSON.stringify([...existing, project]));
  };
  return (
    <ProjectContext.Provider value={{ createNewProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
```

---

## ▶️ Running the App

### On your phone (easiest)

1. Install the **Expo Go** app on your Android or iPhone.
2. In your terminal run:
   ```bash
   npx expo start
   ```
3. Scan the QR code with the Expo Go app (Android) or the Camera app (iPhone).

### On an Android emulator

```bash
# Start Android emulator first (via Android Studio AVD Manager), then:
npx expo start --android
```

### On an iOS simulator (Mac only)

```bash
npx expo start --ios
```

---

## 🧪 Testing your changes

There is no automated test suite yet. To manually test after making changes:

1. Run `npx expo start` — the app hot-reloads on every save.
2. Test the full workflow:
   - Create a project → add buildings/floors/parking
   - Open the project → create a report
   - In the **Walk Mode** screen (`editor.tsx`) — tap floor camera buttons to add defects
   - Tap **"סקירת ליקויים"** to go to the **Review Mode** screen (`review.tsx`)
   - Edit defect notes, assign responsible party, add photos
   - Go back to the project → tap "Export" to generate a Word document

---

## 💡 Using GitHub Copilot in VS Code (same as VS 2026 Community)

Yes, GitHub Copilot works in VS Code with the **exact same inline suggestion experience** as Visual Studio 2026 Community.

### Step 1 — Install GitHub Copilot in VS Code

1. Open **VS Code**
2. Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on Mac) to open Extensions
3. Search for **"GitHub Copilot"** and install it
4. Also install **"GitHub Copilot Chat"** for the chat panel

### Step 2 — Sign in

1. After installing, click the **Accounts** icon (bottom-left in VS Code)
2. Select **"Sign in with GitHub to use GitHub Copilot"**
3. Complete the browser sign-in

### Step 3 — Use inline suggestions (same as VS 2026)

Just start typing — Copilot will show grey ghost-text suggestions inline, exactly like in Visual Studio:

| Action | VS 2026 | VS Code |
|---|---|---|
| **Accept** the suggestion | `Tab` | `Tab` |
| **Reject** the suggestion | `Esc` | `Esc` |
| See next suggestion | `Alt+]` | `Alt+]` |
| See previous suggestion | `Alt+[` | `Alt+[` |
| Open Copilot chat | Side panel | `Ctrl+Alt+I` |

### Step 4 — Open this project in VS Code

```bash
# From your terminal, inside the project folder:
code .
```

Copilot will immediately start helping with suggestions as you type in any `.tsx` file.

### Tips for working with this app

- When editing a screen file, type a comment like `// create a new function that...` and Copilot will suggest the implementation
- In the Copilot Chat panel (`Ctrl+Alt+I`), you can ask questions like:
  - *"Add a search bar to the index screen"*
  - *"Add a total defect count to the PDF export"*
  - *"Explain what buildLocationTree does"*
- Select a block of code and press `Ctrl+I` to ask Copilot to edit just that selection inline

---

## 📦 Building for distribution

To build a standalone APK (Android) or IPA (iOS):

```bash
# Log in to your Expo account (free)
eas login

# Configure the build
eas build:configure

# Build for Android (APK for direct install)
eas build --platform android --profile preview

# Build for iOS (requires Apple Developer account)
eas build --platform ios
```

---

## 🗂 Data model (AsyncStorage)

All data is stored locally on the device in `AsyncStorage` under the key `'projects'`:

```ts
// projects: Project[]
interface Project {
  id: string;
  name: string;
  startDate: string;
  structure: {
    buildings: { id: string; name: string; floors: number }[];
    parkings:  { id: string; name: string; floors: number; areas?: { id: string; name: string }[] }[];
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
  images: string[];  // local file URIs
}
```
