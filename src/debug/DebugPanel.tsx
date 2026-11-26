import { useSyncExternalStore } from 'react'
import { shelvedCount } from '../core/library'
import type { LibraryStore } from '../core/libraryStore'
import { createTestBooks, nextTestSerial } from './testBooks'

interface DebugPanelProps {
  store: LibraryStore
}

// 개발자 테스트 패널. 실제 코어 함수(store)를 호출하며 저장은 하지 않는다.
// 디버그 빌드에서만 불러온다(App.tsx 참고).
export default function DebugPanel({ store }: DebugPanelProps) {
  const state = useSyncExternalStore(store.subscribe, store.getState)
  const shelved = shelvedCount(state)

  const acquire = (count: number) => {
    if (count > 0) store.acquireMany(createTestBooks(count, nextTestSerial(store.getState())))
  }

  return (
    <aside className="debug-panel" aria-label="개발자 테스트 패널">
      <p className="debug-panel__status">
        책장 {shelved}/{state.shelfCapacity} · 보관함 {state.storage.length}
      </p>
      <div className="debug-panel__buttons">
        <button type="button" onClick={() => acquire(1)}>도서 1권</button>
        <button type="button" onClick={() => acquire(10)}>도서 10권</button>
        <button type="button" onClick={() => acquire(state.shelfCapacity - shelved)}>
          책장 채우기
        </button>
        <button type="button" onClick={() => store.reset()}>초기화</button>
      </div>
    </aside>
  )
}
