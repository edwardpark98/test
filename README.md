# PillTime

Your medication and physio plan, on time. A native Expo app built from the PillTime web design, with real reminders scheduled on the phone itself.

## What it does

- **Today**: a 24-hour dial of today's doses, what's next or overdue, and Take / Skip / Log buttons.
- **Plan**: each medicine and physio exercise, with its times, course length and label instructions.
- **Log**: the last 14 days at a glance and every dose you logged.
- **More**: reminders, backup and restore, and erase.

### Reminders

Reminders are local notifications that the phone schedules itself, so they arrive with the app closed and the phone offline.

- One notification per dose time. Doses due at the same time share one notification.
- Each notification has **Taken**, **Snooze 10 min** and **Skip** buttons. A physio session has **Done**.
- Dose times **repeat weekly**, so reminders keep coming even if you never open the app. A time switches to a one-off reminder when it changes within the week (a course ending or starting).
- If you don't log a dose, a **"Still due"** follow-up arrives 30 minutes later, for doses in the next 24 hours. You can turn this off in More.
- Logging a dose early cancels today's reminder for it.
- On iPhone, reminders are **Time Sensitive**, so they come through Focus modes. This needs a real build; Expo Go can't do it.
- No reminders are scheduled while the sample plan is showing.
- iOS allows at most 64 waiting notifications per app. A plan with more than about 8 dose times a day can't fit weekly repeats, so PillTime schedules as many days ahead as fit and ends with a reminder to open the app.
- Today shows a red banner whenever reminders are off, or (on Android) when they may arrive late. On Android 14 and later, allow **Alarms & reminders** for PillTime so they arrive on the minute.

Your data stays on the phone, in the same format as the web app's backup. A backup from the web version can be restored here (More → Restore).

## Run it on your phone

### Quick try: Expo Go (no account needed)

1. Install **Expo Go** from the App Store or Play Store.
2. On a computer with Node 20 or later:
   ```sh
   npm install
   npx expo start
   ```
3. Scan the QR code with the iPhone camera, or from inside Expo Go on Android.

Local reminders work in Expo Go. Reminders are tied to Expo Go rather than PillTime, though, and the app shows Expo Go's icon. For everyday use, install a real build.

### Install as its own app with a free Apple ID (AltStore)

Build an `.ipa` on your Mac with `npm run build:ipa` and install it through AltStore. It needs renewing weekly from the Mac. Full steps: [docs/ALTSTORE.md](docs/ALTSTORE.md).

### Install as its own app (EAS Build)

```sh
npm install -g eas-cli
eas login
eas init                                     # links the project to your Expo account
eas build --profile preview --platform android   # gives you an .apk to install directly
eas build --profile preview --platform ios       # needs an Apple Developer account
```

- **Android**: open the build link on your phone, download the APK and install it. A free Expo account is enough.
- **iPhone**: needs an Apple Developer Program membership ($99/year). Run `eas device:create` first to register your phone, then build. Alternatively, `eas build --profile production --platform ios --auto-submit` sends the app to TestFlight.

## Development

```sh
npx expo start        # dev server
npm run typecheck     # typecheck
npm run lint          # lint
npm test              # reminder planner tests
```

| Path | What it is |
| --- | --- |
| `App.tsx` | App state, tab bar, toasts, notification button handling |
| `src/lib.ts` | Data model, storage, schedule logic (ported from the web app) |
| `src/notify.ts` | Reminder scheduling, notification categories and permissions |
| `src/screens.tsx` | Today, Plan, Log and More screens |
| `src/sheets.tsx` | Add/edit, physio log, restore and erase sheets |
| `src/Dial.tsx`, `src/Loader.tsx` | The 24-hour dial and the opening animation |

PillTime shows the schedule you enter, reminds you, and records what you did. It does not recommend or change treatment.
