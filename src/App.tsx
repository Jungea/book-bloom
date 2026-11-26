import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { createLibraryStore, type LibraryStore } from './core/libraryStore'
import { createIndexedDbStorage } from './data/indexedDbStorage'
import type { LibraryStorage } from './data/libraryStorage'
import { loadLibrary } from './data/loadLibrary'
import { attachPersistence } from './data/persistLibrary'
import { LIBRARY_STORE_KEY, LibraryScene } from './game/LibraryScene'
import { TEMP_SHELF_CAPACITY } from './game/shelfLayout'

// 테스트 패널과 테스트 데이터는 개발 서버(DEV)나 `--mode debug` 빌드에서만 쓴다.
// 일반 빌드에서는 조건이 상수로 평가되어 패널 코드가 번들에서 빠진다.
const DEBUG_BUILD = import.meta.env.DEV || import.meta.env.MODE === 'debug'
const DebugPanel = DEBUG_BUILD ? lazy(() => import('./debug/DebugPanel')) : null
// 테스트 데이터가 실제 데이터와 섞이지 않도록 저장소 이름을 나눈다.
const DATABASE_NAME = DEBUG_BUILD ? 'bookbloom-debug' : 'bookbloom'

interface Boot {
  store: LibraryStore
  storage: LibraryStorage
  loadNotice: string | null
}

export function App() {
  const [boot, setBoot] = useState<Boot | null>(null)

  // 저장된 도서관을 먼저 불러온 뒤 게임을 시작한다. 책이 비었다가 채워지는 깜빡임을 막는다.
  useEffect(() => {
    let cancelled = false
    const storage = createIndexedDbStorage(DATABASE_NAME)
    void loadLibrary(storage, TEMP_SHELF_CAPACITY).then(({ state, notice }) => {
      if (cancelled) return
      setBoot({
        store: createLibraryStore(TEMP_SHELF_CAPACITY, state),
        storage,
        loadNotice: notice,
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!boot) return <main className="page" />
  return <LibraryView store={boot.store} storage={boot.storage} loadNotice={boot.loadNotice} />
}

interface LibraryViewProps {
  store: LibraryStore
  storage: LibraryStorage
  loadNotice: string | null
}

function LibraryView({ store, storage, loadNotice }: LibraryViewProps) {
  const canvasHost = useRef<HTMLDivElement>(null)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)

  useEffect(() => {
    const persistence = attachPersistence(
      store,
      storage,
      (error) => {
        console.error('도서관을 저장하지 못했습니다.', error)
        setSaveNotice('도서관을 저장하지 못했습니다. 변경 사항이 사라질 수 있습니다.')
      },
      () => setSaveNotice(null),
    )
    return persistence.detach
  }, [store, storage])

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
      game.scale.refresh()
    })
    observer.observe(host)

    return () => {
      observer.disconnect()
      game.destroy(true)
    }
  }, [store])

  const notice = saveNotice ?? loadNotice

  return (
    <main className="page">
      <h1 className="sr-only">북블룸 도서관</h1>
      <div className="game-frame" ref={canvasHost} aria-label="북블룸 도서관 초기 화면" />
      {notice && (
        <p className="storage-notice" role="alert">
          {notice}
        </p>
      )}
      {DebugPanel && (
        <Suspense fallback={null}>
          <DebugPanel store={store} />
        </Suspense>
      )}
    </main>
  )
}
