import { settleDueLoans } from '../core/circulation'
import type { Game, Outcome } from '../reading/reading'

/**
 * 개발자 테스트용: 대출 중인 모든 도서의 반납 예정 시각을 지금으로 당기고 만기 처리를 한다.
 * 대출 기간(임시 60초)을 기다리지 않고 반납 트레이 누적을 확인하게 한다. 디버그 빌드에서만 쓴다.
 */
export function expireLoans(game: Game, nowMs: number): Outcome {
  const loans = game.library.circulation.loans.map((loan) =>
    loan.status === 'ON_LOAN' ? { ...loan, dueAt: Math.min(loan.dueAt ?? nowMs, nowMs) } : loan,
  )
  const library = settleDueLoans(
    { ...game.library, circulation: { ...game.library.circulation, loans } },
    nowMs,
  )
  return { ok: true, game: { ...game, library } }
}
