import type { GameStore } from '../reading/gameStore'
import { toGameSnapshot } from '../reading/gameSnapshot'
import type { Game } from '../reading/reading'
import type { GameStorage } from './gameStorage'

export interface Persistence {
  /** 대기 중인 저장이 모두 끝날 때까지 기다린다. */
  flush(): Promise<void>
  detach(): void
}

/**
 * 게임 상태(독서 기록과 도서관)가 바뀔 때마다 한 덩어리로 저장한다.
 * 저장은 한 번에 하나씩 순서대로 하며, 저장 중에 여러 번 바뀌면 마지막 상태만 이어서 저장한다.
 * 저장이 실패해도 멈추지 않고 onError로 알린 뒤 다음 변경 때 다시 시도한다. 저장에 성공하면 onSaved를 부른다.
 */
export function attachPersistence(
  store: GameStore,
  storage: GameStorage,
  onError: (error: unknown) => void,
  onSaved?: () => void,
): Persistence {
  let latest: Game | null = null
  let writing = false
  let current: Promise<void> = Promise.resolve()

  const drain = async () => {
    try {
      while (latest) {
        const game = latest
        latest = null
        try {
          await storage.save(toGameSnapshot(game))
          onSaved?.()
        } catch (error) {
          onError(error)
        }
      }
    } finally {
      writing = false
    }
  }

  const unsubscribe = store.subscribe(() => {
    latest = store.getState()
    if (writing) return
    writing = true
    current = drain()
  })

  return {
    flush: () => current,
    detach: unsubscribe,
  }
}
