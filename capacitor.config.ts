import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tradepulse.pro',
  appName: 'TradePulse Pro',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
