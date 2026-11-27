import {
  availableBookIds,
  cancelReservation,
  reserveBook,
  startLoan,
} from '../core/circulation'
import type { HookResult, ReserveResult, VisitorHooks } from '../core/visitorWorld'
import type { GameStore } from './gameStore'

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
