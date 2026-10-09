# Setup from zero

- adb: download `platform-tools-latest-windows.zip` (Google) → unzip `~/platform-tools-install/`; macOS `brew install --cask android-platform-tools`. Resolve order: env `ADB` → that path → PATH.
- Phone: Developer options (tap Build number ×7) → USB debugging ON → data cable → accept "Allow USB debugging? RSA" with "Always allow". Check: `adb devices` → `<serial>  device`.
- `adb devices` empty but phone shows "USB debugging connected": toggle USB debugging off→on, replug, or switch USB mode to PTP (LG exposes ADB composite there, not under plain MTP).
- Target browser: Quetta `net.quetta.browser` (Play Store) or Edge Canary/Helium; must be running to expose a devtools socket.
- Sanity: `adb devices` → `cat /proc/net/unix | grep devtools` → `adb forward tcp:9225 localabstract:<sock>` → `curl localhost:9225/json/version` shows `Android-Package`.
