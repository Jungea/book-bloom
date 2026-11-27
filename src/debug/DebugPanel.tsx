import { useState, useSyncExternalStore } from 'react'
import { shelvedCount } from '../core/library'
import type { VisitorWorld } from '../core/visitorWorld'
import type { GameStore } from '../reading/gameStore'
import { registerBook, startReading, type Game, type Outcome } from '../reading/reading'
import { readingActions, readingStatusLabel, testBookInput } from './readingActions'
import { createTestBooks, nextTestSerial } from './testBooks'

interface DebugPanelProps {
  store: GameStore
  visitors: VisitorWorld
}

// 개발자 테스트 패널. 실제 코어 함수(store)를 호출하며 저장은 상태 변경을 따라 자동으로 된다.
// 디버그 빌드에서만 불러온다(App.tsx 참고).
export default function DebugPanel({ store, visitors }: DebugPanelProps) {
  const game = useSyncExternalStore(store.subscribe, store.getState)
  const visitorCount = useSyncExternalStore(visitors.subscribe, () => visitors.getVisitors().length)
  const { library, reading } = game
  const shelved = shelvedCount(library)
  const [message, setMessage] = useState<string | null>(null)

  const acquire = (count: number) => {
    if (count > 0) store.acquireMany(createTestBooks(count, nextTestSerial(store.getState().library)))
  }

  // 코어가 거절한 동작은 상태를 바꾸지 않으므로 사유만 보여 준다.
  const run = (action: (current: Game) => Outcome) => {
    const outcome = store.apply(action)
    setMessage(outcome.ok ? null : outcome.reason)
  }

  const register = (start: boolean) => {
    const result = store.apply((current) => registerBook(current, testBookInput(current)))
    if (!result.ok) {
      setMessage(result.reason)
      return
    }
    setMessage(null)
    if (start) run((current) => startReading(current, result.bookId))
  }

  return (
    <aside className="debug-panel" aria-label="개발자 테스트 패널">
      <p className="debug-panel__status">
        책장 {shelved}/{library.shelfCapacity} · 보관함 {library.storage.length}
      </p>
      <div className="debug-panel__buttons">
        <button type="button" onClick={() => acquire(1)}>도서 1권</button>
        <button type="button" onClick={() => acquire(10)}>도서 10권</button>
        <button type="button" onClick={() => acquire(library.shelfCapacity - shelved)}>
          책장 채우기
        </button>
        <button
          type="button"
          onClick={() => {
            store.reset()
            setMessage(null)
          }}
        >
          초기화
        </button>
      </div>

      <p className="debug-panel__status">손님 {visitorCount}명 (자동 생성 중)</p>
      <div className="debug-panel__buttons">
        <button type="button" onClick={() => setMessage(visitors.spawn() ? null : '동시 방문 인원이 가득 찼습니다.')}>
          손님 1명
        </button>
        <button type="button" onClick={() => visitors.clear()}>손님 모두 제거</button>
      </div>

      <p className="debug-panel__status">독서 기록 · 등록 도서 {reading.books.length}</p>
      <div className="debug-panel__buttons">
        <button type="button" onClick={() => register(false)}>도서 등록</button>
        <button type="button" onClick={() => register(true)}>등록하고 시작</button>
      </div>
      {message && (
        <p className="debug-panel__message" role="status">
          {message}
        </p>
      )}
      {reading.books.length > 0 && (
        <ul className="debug-panel__books">
          {reading.books.map((book) => (
            <li key={book.id}>
              <span className="debug-panel__book-title">
                {book.title} · {readingStatusLabel(game, book.id)}
              </span>
              <span className="debug-panel__buttons">
                {readingActions(game, book.id).map((action) => (
                  <button key={action.label} type="button" onClick={() => run(action.run)}>
                    {action.label}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
