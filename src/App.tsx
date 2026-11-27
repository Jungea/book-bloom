import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { createGameStore, type GameStore } from './reading/gameStore'
import { createIndexedDbStorage } from './data/indexedDbStorage'
import type { GameStorage } from './data/gameStorage'
import { loadGame } from './data/loadGame'
import { attachPersistence } from './data/persistGame'
import { createVisitorWorld, type VisitorWorld } from './core/visitorWorld'
import { GAME_STORE_KEY, LibraryScene, VISITOR_WORLD_KEY } from './game/LibraryScene'
import { TEMP_SHELF_CAPACITY } from './game/shelfLayout'
import { TEMP_LOAN_DURATION_MS, VISITOR_CONFIG } from './game/visitorLayout'
import { createCirculationHooks } from './reading/gameCirculation'
import ReadingScreen from './reading/ReadingScreen'
import { lockOrientation } from './orientation'

// 테스트 패널과 테스트 데이터는 개발 서버(DEV)나 `--mode debug` 빌드에서만 쓴다.
// 일반 빌드에서는 조건이 상수로 평가되어 패널 코드가 번들에서 빠진다.
const DEBUG_BUILD = import.meta.env.DEV || import.meta.env.MODE === 'debug'
const DebugPanel = DEBUG_BUILD ? lazy(() => import('./debug/DebugPanel')) : null
// 테스트 데이터가 실제 데이터와 섞이지 않도록 저장소 이름을 나눈다.
const DATABASE_NAME = DEBUG_BUILD ? 'bookbloom-debug' : 'bookbloom'

type Boot =
  | { ok: true; store: GameStore; storage: GameStorage; loadNotice: string | null }
  | { ok: false; message: string }

export function App() {
  const [boot, setBoot] = useState<Boot | null>(null)

  // 저장된 게임(독서 기록·도서관)을 먼저 불러온 뒤 게임을 시작한다. 책이 비었다가 채워지는 깜빡임을 막는다.
  // 불러오지 못하면 게임을 시작하지 않는다. 저장소·저장 연결을 만들지 않으므로 기존 데이터를 덮어쓸 수 없다.
  useEffect(() => {
    let cancelled = false
    const storage = createIndexedDbStorage(DATABASE_NAME)
    void loadGame(storage, TEMP_SHELF_CAPACITY).then((loaded) => {
      if (cancelled) return
      if (!loaded.ok) {
        setBoot({ ok: false, message: loaded.message })
        return
      }
      setBoot({
        ok: true,
        store: createGameStore(TEMP_SHELF_CAPACITY, loaded.game),
        storage,
        loadNotice: loaded.notice,
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!boot) return <main className="page" />
  if (!boot.ok) {
    return (
      <main className="page">
        <p className="load-error" role="alert">
          {boot.message}
        </p>
      </main>
    )
  }
  return <Shell store={boot.store} storage={boot.storage} loadNotice={boot.loadNotice} />
}

type View = 'library' | 'reading'

interface ShellProps {
  store: GameStore
  storage: GameStorage
  loadNotice: string | null
}

/**
 * 도서관(가로형)과 독서관리(세로형)를 오가는 최상위 화면.
 * 저장 연결은 여기에 두어 화면을 바꿔도 끊기지 않고, 상태는 저장소가 들고 있어 전환으로 초기화되지 않는다.
 */
function Shell({ store, storage, loadNotice }: ShellProps) {
  const [view, setView] = useState<View>('library')
  // 손님은 메모리에만 있고(v0.2) 화면을 오가도 유지된다. 시간은 도서관 화면에서만 흐른다(임시 동작).
  const [visitors] = useState<VisitorWorld>(() =>
    createVisitorWorld(
      VISITOR_CONFIG,
      createCirculationHooks(store, {
        now: Date.now,
        random: Math.random,
        loanDurationMs: TEMP_LOAN_DURATION_MS,
      }),
    ),
  )
  const [saveNotice, setSaveNotice] = useState<string | null>(null)

  useEffect(() => {
    const persistence = attachPersistence(
      store,
      storage,
      (error) => {
        console.error('저장하지 못했습니다.', error)
        setSaveNotice('저장하지 못했습니다. 변경 사항이 사라질 수 있습니다.')
      },
      () => setSaveNotice(null),
    )
    return persistence.detach
  }, [store, storage])

  // Android 앱에서는 화면에 맞게 방향을 바꾼다(도서관 가로, 독서 관리 세로). 웹에서는 아무 동작이 없다.
  useEffect(() => {
    void lockOrientation(view)
  }, [view])

  const notice = saveNotice ?? loadNotice

  return (
    <main className={view === 'reading' ? 'page page--reading' : 'page'}>
      {view === 'library' ? (
        <LibraryView store={store} visitors={visitors} onOpenReading={() => setView('reading')} />
      ) : (
        <ReadingScreen store={store} onOpenLibrary={() => setView('library')} />
      )}
      {notice && (
        <p className="storage-notice" role="alert">
          {notice}
        </p>
      )}
    </main>
  )
}

interface LibraryViewProps {
  store: GameStore
  visitors: VisitorWorld
  onOpenReading: () => void
}

function LibraryView({ store, visitors, onOpenReading }: LibraryViewProps) {
  const canvasHost = useRef<HTMLDivElement>(null)

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
        preBoot: (instance) => {
          instance.registry.set(GAME_STORE_KEY, store)
          instance.registry.set(VISITOR_WORLD_KEY, visitors)
        },
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
  }, [store, visitors])

  return (
    <>
      <h1 className="sr-only">북블룸 도서관</h1>
      <div className="game-frame" ref={canvasHost} aria-label="북블룸 도서관 초기 화면" />
      <button type="button" className="view-switch" onClick={onOpenReading}>
        독서 관리
      </button>
      {DebugPanel && (
        <Suspense fallback={null}>
          <DebugPanel store={store} visitors={visitors} />
        </Suspense>
      )}
    </>
  )
}
