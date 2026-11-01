import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'lat.lifekeeper.app',
  appName: 'LifeKeeper',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_lifekeeper',
      iconColor: '#1d63dc',
    },
  },
  android: {
    backgroundColor: '#0a0a0c',
    allowMixedContent: true,
    captureInput: true,
  },
}

export default config
