import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'lat.lifekeeper.app',
  appName: 'LifeKeeper',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    backgroundColor: '#0a0a0c',
    allowMixedContent: true,
    captureInput: true,
  },
}

export default config
