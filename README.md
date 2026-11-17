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
- If you don't log a dose, a **"Still due"** follow-up arrives 30 minutes later. You can turn this off in More.
- Logging a dose in the app cancels its reminder.
- The schedule covers the next 7 days and is rebuilt every time you open the app. iOS allows at most 64 waiting notifications per app. On a busy plan this may cover fewer than 7 days, and PillTime then sends a reminder asking you to open the app.
- On Android 14 and later, allow **Alarms & reminders** for PillTime (More → Exact timing) so reminders arrive on the minute.

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
npx tsc --noEmit      # typecheck
npx expo lint         # lint
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
