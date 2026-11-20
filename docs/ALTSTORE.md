# Install PillTime on your iPhone with AltStore

AltStore installs PillTime as a real app on your home screen with a free Apple ID: no $99 developer account and no laptop needed to open it. The catch: a free Apple ID signs apps for 7 days, so your Mac must be awake, running AltServer, on the same Wi-Fi as your iPhone at least once a week so AltStore can renew PillTime. If 7 days pass without that, PillTime won't open until you renew it. Your data is kept.

Differences from a developer-account build:
- Reminders aren't **Time Sensitive**, so a Focus mode can hold them back. Allow PillTime in your Focus settings (step 7).
- A free Apple ID can have 3 sideloaded apps at once, and AltStore counts as one.

You do steps 1–4 once. Steps 5–7 happen each time you install a new version.

Your Mac needs AltServer (any macOS from 11 Big Sur onwards); it doesn't need Xcode.

## 1. Get PillTime.ipa

The `.ipa` (the app file) is built on a Mac in the cloud by GitHub Actions, so your Mac doesn't need Xcode. This works on any macOS version, including Monterey.

1. On github.com, open the PillTime repository → **Actions** → **Build iPhone app (AltStore)** → **Run workflow** → **Run workflow**. Skip this if Claude has already started a build for you.
2. Wait for the green tick, usually 15–25 minutes.
3. Open the run and, under **Artifacts**, download **PillTime-ipa**. It is a .zip: double-click it to get **PillTime.ipa**.

On a Mac running macOS 14 or later with the latest Xcode, you can build it locally instead with `npm run build:ipa`. That needs Xcode from the App Store and `brew install cocoapods`.

## 2. Prepare your iPhone

1. Connect the iPhone to your Mac with a cable. Unlock it and tap **Trust**.
2. In Finder, select your iPhone in the sidebar and tick **Show this iPhone when on Wi-Fi**, then **Apply**. This lets AltStore renew PillTime without the cable.
3. On the iPhone, turn on **Settings → Privacy & Security → Developer Mode** and restart when asked. The option only appears after AltStore has installed an app once, so if you don't see it yet, do step 3 first and come back.

## 3. Install AltServer and AltStore

1. Download **AltServer for macOS** from https://altstore.io, move it to Applications and open it. It lives in the menu bar (a diamond icon).
2. Follow AltServer's prompts. Older versions ask you to enable a plug-in in Mail.
3. With the iPhone connected and unlocked, click the AltServer icon → **Install AltStore** → your iPhone. Sign in with your Apple ID when asked. The password goes only to Apple.
4. On the iPhone: **Settings → General → VPN & Device Management**, tap your Apple ID, then **Trust**.
5. Open AltStore once to check it works.

## 4. Save your current data (if you've been using Expo Go)

PillTime in Expo Go and the AltStore app are separate apps, so data doesn't move across on its own.

1. In Expo Go, open PillTime → **More → Back up**, and save the text to Notes or Files.
2. After step 6, open the new PillTime → **More → Restore** and paste it in.

## 5. Get the latest PillTime.ipa

Run the build again (step 1) and download the new PillTime-ipa artifact.

## 6. Install it

1. AirDrop **PillTime.ipa** to your iPhone and choose **Save to Files**. iCloud Drive works too.
2. Open **AltStore → My Apps**, tap **+** at the top left, and pick PillTime.ipa.
3. PillTime appears on your home screen. Open it, add your medicine (or restore your backup) and allow notifications when asked.
4. Check reminders: **More → Test**, then lock the phone. A reminder should arrive within 5 seconds.

## 7. Keep it running

- **Renewal:** AltStore → My Apps shows the days left. It renews by itself in the background when AltServer is running on your Mac and both are on the same Wi-Fi. Keep **Settings → General → Background App Refresh** on for AltStore. You can also tap **Refresh All**.
- **Focus modes:** Settings → Focus → each Focus you use → **Apps → Add PillTime**, so reminders still come through.
- **Updating to a new version:** repeat steps 5 and 6. Installing over the old version keeps your data.

## If something goes wrong

| Problem | Fix |
| --- | --- |
| The GitHub build fails (red cross) | Send Claude the link to the run |
| AltStore says "Maximum app limit reached" | Remove another sideloaded app; free Apple IDs allow 3 including AltStore |
| PillTime won't open ("Unable to verify app") | It has expired: open AltStore with the Mac's AltServer running, then Refresh All |
| Reminders stopped arriving | Open PillTime: a red banner on Today shows if notifications are off |
