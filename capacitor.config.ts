import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'lat.lifekeeper.app',
  appName: 'LifeKeeper',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#0a0a0c',
    allowMixedContent: false,
    captureInput: true,
  },
}

export default config
