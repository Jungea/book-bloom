// v0.3 4단계 반납 트레이 정리. 트레이를 클릭하면 시간제 정리가 시작되고, 정해진 시간마다 한 권씩 책장으로 돌아가며,
// 정리 중 다시 클릭하면 처리 중인 한 권이 즉시 돌아간다. 대기열이 비면 멈추고 새로 쌓인 도서는 다시 클릭해야 한다.
// Phaser·React와 무관하며 도서관 상태는 훅으로만 만난다. 진행률은 메모리에만 있다(저장하지 않는다).

/** 탭을 오래 떠났다 돌아왔을 때 한 번에 진행하는 시간의 상한. */
export const MAX_SORT_TICK_MS = 250

export type SortResult =
  | { readonly ok: true; readonly bookId: string }
  | { readonly ok: false; readonly reason: string }

/**
 * 정리 객체가 도서관 상태와 만나는 지점. 예외를 던지지 않고 성공·실패를 값으로 돌려준다.
 * `sortNext`는 호출하는 순간 반납 대기열의 맨 앞 도서를 정리하므로, 진행 중에 어떤 도서가 회수되어도
 * 정리 대상을 따로 붙들고 있지 않아 대기열이 막히지 않는다.
 */
export interface SortHooks {
  /** 정리를 기다리는 반납 도서 수. */
  returnedCount(): number
  /** 가장 오래 기다린 도서 한 권을 책장 원래 위치로 되돌린다. 대기열이 비었거나 실패하면 ok: false. */
  sortNext(): SortResult
}

export interface SorterConfig {
  /** 한 권을 정리하는 시간. */
  readonly sortMs: number
}

export type ClickResult = 'STARTED' | 'SORTED_NOW' | 'IGNORED'

export interface ReturnSorter {
  isActive(): boolean
  /** 현재 도서의 진행률(0 이상 1 미만). */
  getProgress(): number
  /** 정리를 시작·종료하거나 한 권이 정리될 때만 알린다. 진행률 변화는 알리지 않는다. */
  subscribe(listener: () => void): () => void
  /** 한 권이 정리될 때마다 도서 id와 함께 알린다. 이동 애니메이션에 쓴다. */
  onSorted(listener: (bookId: string) => void): () => void
  /** 시간을 진행시킨다. 정리 중일 때만 흐른다. */
  tick(dtMs: number): void
  /** 트레이 클릭. 정리 중이 아니면 시작, 정리 중이면 처리 중인 한 권을 즉시 정리한다. */
  click(): ClickResult
  reset(): void
}

export function createReturnSorter(config: SorterConfig, hooks: SortHooks): ReturnSorter {
  let active = false
  let progressMs = 0
  const listeners = new Set<() => void>()
  const sortedListeners = new Set<(bookId: string) => void>()

  const guard = (label: string, run: () => void) => {
    try {
      run()
    } catch (error) {
      console.error(`${label} 처리 중 오류가 발생했습니다.`, error)
    }
  }
  const notify = () => listeners.forEach((listener) => guard('정리 구독자', listener))

  const stop = () => {
    active = false
    progressMs = 0
  }

  /** 한 권을 정리한다. 실패하면(대기열이 비었거나 훅이 실패) 정리를 멈춘다. 반복해서 시도하지 않는다. */
  const sortOne = (): boolean => {
    const result = hooks.sortNext()
    if (!result.ok) {
      stop()
      return false
    }
    sortedListeners.forEach((listener) => guard('정리 완료 구독자', () => listener(result.bookId)))
    return true
  }

  return {
    isActive: () => active,
    getProgress: () => (active && config.sortMs > 0 ? Math.min(progressMs / config.sortMs, 0.999999) : 0),
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    onSorted(listener) {
      sortedListeners.add(listener)
      return () => {
        sortedListeners.delete(listener)
      }
    },
    tick(dtMs) {
      if (!active) return
      const dt = Math.min(Math.max(dtMs, 0), MAX_SORT_TICK_MS)
      if (dt === 0) return

      if (hooks.returnedCount() === 0) {
        // 정리하던 도서가 회수되는 등으로 대기열이 비었다. 멈춘다.
        stop()
        notify()
        return
      }

      progressMs += dt
      let changed = false
      // 큰 시간이 한 번에 주어져도 100%마다 한 권씩 정리하고 남은 시간을 다음 도서로 이어 쓴다.
      while (active && progressMs >= config.sortMs) {
        progressMs -= config.sortMs
        const sorted = sortOne()
        changed = true
        if (!sorted) break
        if (hooks.returnedCount() === 0) {
          stop() // 대기열이 비면 멈춘다. 새로 쌓인 도서는 다시 클릭해야 정리가 시작된다.
          break
        }
      }
      if (changed) notify()
    },
    click() {
      if (!active) {
        if (hooks.returnedCount() === 0) return 'IGNORED'
        active = true
        progressMs = 0
        notify()
        return 'STARTED'
      }
      progressMs = 0
      const sorted = sortOne()
      if (sorted && hooks.returnedCount() === 0) stop()
      notify()
      return sorted ? 'SORTED_NOW' : 'IGNORED'
    },
    reset() {
      const wasActive = active
      stop()
      if (wasActive) notify()
    },
  }
}
