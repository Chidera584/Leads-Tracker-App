import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.leadstracker.app',
  appName: 'Leads Tracker Pro',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#5f9341",
      showSpinner: false,
      androidSpinnerStyle: "large",
      spinnerColor: "#ffffff"
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#5f9341"
    },
    App: {
      launchUrl: "index.html"
    }
  }
};

export default config;