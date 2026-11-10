declare module '@capacitor/browser' {
  export interface OpenOptions {
    url: string
    windowName?: string
    toolbarColor?: string
    presentationStyle?: 'fullscreen' | 'popover'
  }

  export const Browser: {
    open(options: OpenOptions): Promise<void>
    close(): Promise<void>
    addListener(eventName: string, listenerFunc: Function): Promise<any>
    removeAllListeners(): Promise<void>
  }
}

declare module '@capacitor/app' {
  export interface AppUrlOpen {
    url: string
    iosSourceApplication?: string
    iosOpenInPlace?: boolean
  }

  export interface PluginListenerHandle {
    remove(): Promise<void>
  }

  export const App: {
    addListener(
      eventName: 'appUrlOpen',
      listenerFunc: (data: AppUrlOpen) => void
    ): Promise<PluginListenerHandle>
    addListener(
      eventName: 'appStateChange',
      listenerFunc: (state: { isActive: boolean }) => void
    ): Promise<PluginListenerHandle>
    addListener(
      eventName: 'backButton',
      listenerFunc: (data: { canGoBack: boolean }) => void
    ): Promise<PluginListenerHandle>
    removeAllListeners(): Promise<void>
    exitApp(): Promise<void>
    getInfo(): Promise<any>
    getState(): Promise<{ isActive: boolean }>
  }
}
