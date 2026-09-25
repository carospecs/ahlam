# Publishing the Ahlam app (iOS + Android)

The app has its icon, splash, bundle IDs, permissions, live backend URL, privacy
policy, in-app account deletion, and Apple/Google/email sign-in UI configured.
It talks to **https://ahlam.io** and the shared Supabase project. Builds use
**EAS** (Expo Application Services).

This guide separates work that is in the source code from the account ownership
steps that only an authorized Apple/Google business owner can complete.

## One-time setup
```bash
npm i -g eas-cli
cd app
eas login                 # your Expo account
eas init                  # links the project, writes extra.eas.projectId
```

Then save the resulting `extra.eas.projectId` in `app.json` and commit it. Do
not use a personal Expo project for a customer release unless the business has
approved that ownership.

## Configure sign-in before an iOS build

1. In Supabase **Auth > Providers**, configure Google with Ahlam's Google OAuth
   client credentials and every production redirect URL.
2. Enroll the Ahlam app in the Apple Developer Program, enable **Sign in with
   Apple** for `io.ahlam.app`, create the Apple provider credentials, and enter
   them in Supabase **Auth > Providers > Apple**.
3. Test email/password, Google, and Apple sign-in on physical devices. Apple
   only supplies a user's name/email on their first authorization, so the app
   must be ready to use Apple's private relay email thereafter.

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

## Before first submission — required owner inputs

- Apple Developer Program enrollment and an App Store Connect app record owned
  by the Ahlam business. Apple controls the team agreement, tax/banking, and
  two-factor authentication; these cannot be created safely by an agent.
- Google Play Console developer account and an app record owned by the Ahlam
  business. Complete the Play **Data safety** declaration and provide a public
  privacy-policy URL: `https://ahlam.io/privacy`.
- Store metadata: support email, copyright, category, age rating/content
  questionnaire, app description, keyword list, and device screenshots.
- A non-owner demo/reviewer login for both stores. Do not submit the founder's
  credentials. The reviewer account must be able to scan a sample image and see
  the resulting draft/listing flow.
- A physical iPhone and Android smoke test: create/sign in, camera permission,
  library upload, review and publish, B2B browse, legal links, and account
  deletion.

## Notes
- Camera/photo permission strings are set in `app.json` (`infoPlist` /
  `android.permissions`).
- The iOS binary includes Sign in with Apple because it also advertises Google
  sign-in. The Apple provider still has to be enabled in Supabase as described
  above.
- `version` (1.0.0) + `ios.buildNumber` / `android.versionCode` are set; the
  `production` profile auto-increments build numbers on each EAS build.
