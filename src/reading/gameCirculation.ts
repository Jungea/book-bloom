import {
  availableBookIds,
  cancelReservation,
  reserveBook,
  returnedCount,
  settleDueLoans,
  sortNextReturned,
  startLoan,
} from '../core/circulation'
import type { SortHooks, SortResult } from '../core/returnSorter'
import type { HookResult, ReserveResult, VisitorHooks } from '../core/visitorWorld'
import type { GameStore } from './gameStore'
import type { Game, Outcome } from './reading'

// 임시 상수: 만기 반영 주기는 기획에서 미정이다. 대출 만기는 절대 시각이라 늦게 반영해도 결과는 같고,
// 반납 트레이에 쌓이는 모습이 곧바로 보이도록 1초로 잡았다.
export const TEMP_SETTLE_INTERVAL_MS = 1000

/**
 * 반납 예정 시각이 지난 대출을 반납 트레이로 옮긴다. 옮길 것이 없으면 같은 게임 객체를 돌려주어
 * 저장소가 변경을 알리지 않고 저장도 일어나지 않는다. 같은 시각으로 여러 번 불러도 결과가 같다.
 */
export function settleDueGame(game: Game, nowMs: number): Outcome {
  const library = settleDueLoans(game.library, nowMs)
  return { ok: true, game: library === game.library ? game : { ...game, library } }
}

export interface CirculationOptions {
  /** 현재 시각(epoch 밀리초). */
  now(): number
  /** 0 이상 1 미만의 난수. */
  random(): number
  /** 대출 기간. */
  loanDurationMs: number
}

/**
 * 손님 월드의 훅을 `GameStore`에 연결한다. 도서 선택과 대출 상태 변경은 여기서만 일어난다.
 * 상태는 `store.apply` 안에서 현재 값으로 계산하므로 월드가 오래된 상태를 쓰지 않는다.
 */
export function createCirculationHooks(store: GameStore, options: CirculationOptions): VisitorHooks {
  return {
    reserve(): ReserveResult {
      const picked: { value: { loanId: string; bookId: string } | null } = { value: null }
      const outcome = store.apply((game) => {
        const candidates = availableBookIds(game.library)
        if (candidates.length === 0) return { ok: false, reason: '대출할 수 있는 도서가 없습니다.' } as const
        const bookId = candidates[Math.floor(options.random() * candidates.length) % candidates.length]
        const result = reserveBook(game.library, bookId, options.now())
        if (!result.ok) return { ok: false, reason: result.reason } as const
        picked.value = { loanId: result.loanId, bookId }
        return { ok: true, game: { ...game, library: result.state } } as const
      })
      if (!outcome.ok) return { ok: false, reason: outcome.reason }
      if (!picked.value) return { ok: false, reason: '도서를 고르지 못했습니다.' }
      return { ok: true, loanId: picked.value.loanId, bookId: picked.value.bookId }
    },

    startLoan(loanId: string): HookResult {
      const outcome = store.apply((game) => {
        const result = startLoan(game.library, loanId, options.now(), options.loanDurationMs)
        if (!result.ok) return { ok: false, reason: result.reason } as const
        return { ok: true, game: { ...game, library: result.state } } as const
      })
      return outcome.ok ? { ok: true } : { ok: false, reason: outcome.reason }
    },

    cancel(loanId: string): void {
      store.apply((game) => {
        const result = cancelReservation(game.library, loanId)
        // 이미 사라진 예약(회수 등)은 해제할 것이 없다.
        if (!result.ok) return { ok: false, reason: result.reason } as const
        return { ok: true, game: { ...game, library: result.state } } as const
      })
    },
  }
}

/** 반납 트레이 정리 객체의 훅을 `GameStore`에 연결한다. 정리 동작은 1단계 코어(`sortNextReturned`)를 쓴다. */
export function createSortHooks(store: GameStore, options: { now(): number }): SortHooks {
  return {
    returnedCount: () => returnedCount(store.getState().library),
    sortNext(): SortResult {
      const picked: { value: string | null } = { value: null }
      const outcome = store.apply((game) => {
        const result = sortNextReturned(game.library, options.now())
        if (!result.ok) return { ok: false, reason: result.reason } as const
        if (result.bookId === null) return { ok: false, reason: '정리할 반납 도서가 없습니다.' } as const
        picked.value = result.bookId
        return { ok: true, game: { ...game, library: result.state } } as const
      })
      if (!outcome.ok) return { ok: false, reason: outcome.reason }
      return picked.value ? { ok: true, bookId: picked.value } : { ok: false, reason: '도서를 정리하지 못했습니다.' }
    },
  }
}
