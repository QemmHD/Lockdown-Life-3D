/**
 * Capacitor configuration for wrapping Lockdown Life 3D into a native iOS app
 * so it can be packaged as an .ipa and sideloaded (e.g. via iOSGods / AltStore /
 * Sideloadly / TrollStore). This file is only used once you add Capacitor —
 * see the "Building an IPA for sideloading" section of README.md.
 *
 * It is safe to keep in the repo without Capacitor installed; the web build
 * (npm run build) does not depend on it.
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lockdownlife.game',
  appName: 'Lockdown Life 3D',
  webDir: 'dist',
  // Lock to landscape feel; the game also shows a rotate hint in portrait.
  backgroundColor: '#0b0d10',
  ios: {
    contentInset: 'always',
    backgroundColor: '#0b0d10'
  },
  server: {
    // Use the bundled web assets (no live reload) for a shippable IPA.
    androidScheme: 'https',
    iosScheme: 'capacitor'
  }
};

export default config;
