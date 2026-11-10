import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.studyup.app',
  appName: 'StudyUp',
  webDir: 'public',
  appendUserAgent: 'StudyUpApp/1.0',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0a0c10',
  },
}

export default config
