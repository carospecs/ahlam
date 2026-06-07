# Publishing the Ahlam app (iOS + Android)

The app is configured and store-ready (icon, splash, bundle IDs, permissions,
`eas.json`). It talks to the live backend at **https://ahlam.io** and the shared
Supabase project. Builds use **EAS** (Expo Application Services).

## One-time setup
```bash
npm i -g eas-cli
cd app
eas login                 # your Expo account
eas init                  # links the project, writes extra.eas.projectId
```

## Build
```bash
# Store-ready binaries (cloud build, no Mac/Android Studio needed)
eas build -p ios --profile production
eas build -p android --profile production

# Quick test builds first:
eas build -p android --profile preview   # installable APK
eas build -p ios --profile preview       # simulator build
```

## Submit to the stores
```bash
eas submit -p ios         # needs an Apple Developer account ($99/yr)
eas submit -p android     # needs a Google Play Console account ($25 one-time)
```

## Accounts you'll need (the only real blockers)
- **Apple Developer Program** — $99/yr — to ship on the App Store.
- **Google Play Console** — $25 one-time — to ship on Play.
- An **Expo** account (free) for EAS builds.

## Backend / env
- API + Supabase keys for builds live in `eas.json` (`build.*.env`, public keys
  only). Local dev reads `app/.env`.
- For local dev pointing at your machine instead of prod, set
  `EXPO_PUBLIC_API_BASE_URL=http://<your-LAN-ip>:3217` in `app/.env`.

## Before first submission — content/store checklist
- App Store screenshots (use `eas build` + a simulator/device).
- Privacy policy URL (App Store requires one).
- App description, keywords, category (Auto/Business).
- Confirm Google sign-in is enabled in Supabase if you advertise it.

## Notes
- Camera/photo permission strings are set in `app.json` (`infoPlist` /
  `android.permissions`).
- `version` (1.0.0) + `ios.buildNumber` / `android.versionCode` are set; the
  `production` profile auto-increments build numbers on each EAS build.
