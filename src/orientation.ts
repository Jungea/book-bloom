import { Capacitor, registerPlugin } from '@capacitor/core'

export type Orientation = 'landscape' | 'portrait'
export type AppView = 'library' | 'reading'

interface OrientationPlugin {
  lock(options: { mode: Orientation }): Promise<void>
}

/** 도서관은 가로, 독서 관리는 세로로 본다. */
export function orientationForView(view: AppView): Orientation {
  return view === 'reading' ? 'portrait' : 'landscape'
}

const plugin = registerPlugin<OrientationPlugin>('Orientation')

/**
 * Android 앱에서만 화면 방향을 고정한다(`OrientationPlugin.java`). 웹에서는 아무것도 하지 않는다.
 * 실패해도 앱을 멈추지 않고 기록만 남긴다.
 */
export async function lockOrientation(view: AppView): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await plugin.lock({ mode: orientationForView(view) })
  } catch (error) {
    console.error('화면 방향을 바꾸지 못했습니다.', error)
  }
}
