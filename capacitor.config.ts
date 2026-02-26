import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chinak.app',
  appName: 'Chinak',
  webDir: 'dist',
  server: {
    // When using a physical device, the app cannot reach 10.0.2.2 (which is only for emulators).
    // For production/physical device testing, we should use the local dist files.
    // In dev mode with 'npx cap run android', the CLI will automatically handle live reload URLs if configured.
    androidScheme: 'http',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#ffffffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      spinnerColor: "#2563eb"
    },
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
