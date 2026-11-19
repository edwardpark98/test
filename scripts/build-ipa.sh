#!/usr/bin/env bash
# Builds PillTime.ipa for installing with AltStore. Run on a Mac with Xcode:
#   npm run build:ipa
# The .ipa is unsigned; AltStore signs it with your Apple ID when it installs it.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
OUT="$ROOT/PillTime.ipa"
BUILD="$ROOT/build/ios"

say() { printf '\n\033[1m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[31mError:\033[0m %s\n' "$1" >&2; exit 1; }

# ---- checks ----
[[ "$(uname)" == "Darwin" ]] || fail "This needs a Mac (Xcode only runs on macOS)."
command -v xcodebuild >/dev/null || fail "Xcode isn't installed. Install it from the Mac App Store, open it once, then run this again."
xcodebuild -version >/dev/null 2>&1 || fail "Xcode isn't set up yet. Run: sudo xcode-select -s /Applications/Xcode.app && sudo xcodebuild -license accept"
command -v pod >/dev/null || fail "CocoaPods isn't installed. Run: brew install cocoapods   (no Homebrew? see https://brew.sh)"
command -v node >/dev/null || fail "Node.js isn't installed. Get the LTS version from https://nodejs.org"

say "1/4  Installing packages"
npm install --no-audit --no-fund

say "2/4  Generating the iOS project (AltStore version)"
# Prebuild rewrites the scripts in package.json; keep the file as it was.
cp package.json "$ROOT/build.package.json.bak"
trap 'mv -f "$ROOT/build.package.json.bak" "$ROOT/package.json" 2>/dev/null || true' EXIT
PILLTIME_SIDELOAD=1 CI=1 npx expo prebuild --platform ios --clean
mv -f "$ROOT/build.package.json.bak" "$ROOT/package.json"
trap - EXIT

WORKSPACE="$(ls -d ios/*.xcworkspace 2>/dev/null | head -1)"
[[ -n "$WORKSPACE" ]] || fail "The iOS workspace wasn't created. Check the CocoaPods output above."
SCHEME="$(basename "$WORKSPACE" .xcworkspace)"

say "3/4  Building $SCHEME for iPhone (a few minutes the first time)"
rm -rf "$BUILD"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$BUILD" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" \
  build | { command -v xcpretty >/dev/null && xcpretty || grep -E "error:|warning: .*deprecated|BUILD (SUCCEEDED|FAILED)" || true; }

APP="$BUILD/Build/Products/Release-iphoneos/$SCHEME.app"
[[ -d "$APP" ]] || fail "The build didn't produce $SCHEME.app. Scroll up for the first 'error:' line."

say "4/4  Packaging PillTime.ipa"
STAGE="$BUILD/ipa"
rm -rf "$STAGE" "$OUT"
mkdir -p "$STAGE/Payload"
cp -R "$APP" "$STAGE/Payload/"
(cd "$STAGE" && zip -qry "$OUT" Payload)

say "Done: $OUT"
echo "Next: AirDrop PillTime.ipa to your iPhone (save it to Files), then in AltStore go to My Apps and tap +."
