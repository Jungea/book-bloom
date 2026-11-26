import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { createLibraryStore } from './core/libraryStore'
import { LIBRARY_STORE_KEY, LibraryScene } from './game/LibraryScene'
import { TEMP_SHELF_CAPACITY } from './game/shelfLayout'

// 테스트 패널은 개발 서버(DEV)나 `--mode debug` 빌드에서만 켠다.
// 일반 빌드에서는 조건이 상수로 평가되어 패널 코드가 번들에서 빠진다.
const DebugPanel =
  import.meta.env.DEV || import.meta.env.MODE === 'debug'
    ? lazy(() => import('./debug/DebugPanel'))
    : null

export function App() {
  const canvasHost = useRef<HTMLDivElement>(null)
  const [store] = useState(() => createLibraryStore(TEMP_SHELF_CAPACITY))

  useEffect(() => {
    if (!canvasHost.current) return

    const host = canvasHost.current
    const logicalWidth = () => Math.max(640, Math.round(360 * host.clientWidth / host.clientHeight))
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: logicalWidth(),
      height: 360,
      backgroundColor: '#e9d5b9',
      pixelArt: true,
      roundPixels: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      callbacks: {
        preBoot: (instance) => instance.registry.set(LIBRARY_STORE_KEY, store),
      },
      scene: [LibraryScene],
    })

    const observer = new ResizeObserver(() => {
      const width = logicalWidth()
      if (game.scale.width !== width) game.scale.setGameSize(width, 360)
    })
    observer.observe(host)

    return () => {
      observer.disconnect()
      game.destroy(true)
    }
  }, [store])

  return (
    <main className="page">
      <h1 className="sr-only">북블룸 도서관</h1>
      <div className="game-frame" ref={canvasHost} aria-label="북블룸 도서관 초기 화면" />
      {DebugPanel && (
        <Suspense fallback={null}>
          <DebugPanel store={store} />
        </Suspense>
      )}
    </main>
  )
}
