import { describe, expect, it } from 'vitest'
import {
  activeLoan,
  availableBookIds,
  bookStatus,
  cancelReservation,
  onLoanCount,
  reinstateBook,
  reserveBook,
  resumeCirculation,
  returnedCount,
  revokeBook,
  settleDueLoans,
  sortNextReturned,
  startLoan,
} from './circulation'
import { acquireBooks, createLibrary, type LibraryState } from './library'

const book = (n: number) => ({ id: `b${n}`, title: `도서 ${n}` })
const HOUR = 3_600_000

function library(capacity: number, count: number): LibraryState {
  return acquireBooks(createLibrary(capacity), Array.from({ length: count }, (_, i) => book(i + 1)))
}

function must<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(JSON.stringify(result))
  return result as Extract<T, { ok: true }>
}

/** b1을 예약·대출까지 진행한 상태. 반납 예정은 now + HOUR. */
function lending(capacity = 3, count = 3, now = 1_000) {
  const reserved = must(reserveBook(library(capacity, count), 'b1', now))
  const loaned = must(startLoan(reserved.state, reserved.loanId, now + 500, HOUR))
  return { state: loaned.state, loanId: reserved.loanId }
}

describe('도서 상태', () => {
  it('진열된 도서는 AVAILABLE, 보관함 도서는 STORED, 없는 도서는 null이다', () => {
    const state = library(2, 3) // b3은 보관함
    expect(bookStatus(state, 'b1')).toBe('AVAILABLE')
    expect(bookStatus(state, 'b3')).toBe('STORED')
    expect(bookStatus(state, 'x')).toBeNull()
  })

  it('대출 가능한 도서는 진열된 도서만 슬롯 순서대로다', () => {
    expect(availableBookIds(library(2, 3))).toEqual(['b1', 'b2'])
  })
})

describe('예약', () => {
  it('고르는 즉시 예약되어 다른 손님은 같은 도서를 고를 수 없다', () => {
    const first = must(reserveBook(library(3, 3), 'b1', 100))
    expect(bookStatus(first.state, 'b1')).toBe('RESERVED')
    expect(availableBookIds(first.state)).toEqual(['b2', 'b3'])

    const second = reserveBook(first.state, 'b1', 200)
    expect(second.ok).toBe(false)
  })

  it('보관함 도서와 없는 도서는 예약할 수 없다', () => {
    const state = library(1, 2) // b2는 보관함
    expect(reserveBook(state, 'b2', 0).ok).toBe(false)
    expect(reserveBook(state, 'x', 0).ok).toBe(false)
  })

  it('예약해도 책장 위치는 그대로다(예약 슬롯은 빈 슬롯이 아니다)', () => {
    const state = library(3, 3)
    const reserved = must(reserveBook(state, 'b2', 0))
    expect(reserved.state.shelf).toEqual(state.shelf)
    // 새 도서는 예약된 슬롯을 건드리지 않고 다음 빈 슬롯에 놓인다.
    const more = acquireBooks(reserved.state, [book(9)])
    expect(more.shelf.map((entry) => entry?.id ?? null)).toEqual(['b1', 'b2', 'b3'])
    expect(more.storage.map((entry) => entry.id)).toEqual(['b9'])
  })

  it('예약을 해제하면 다시 대출할 수 있다', () => {
    const reserved = must(reserveBook(library(3, 3), 'b1', 0))
    const released = must(cancelReservation(reserved.state, reserved.loanId))
    expect(bookStatus(released.state, 'b1')).toBe('AVAILABLE')
    expect(must(reserveBook(released.state, 'b1', 10)).loanId).not.toBe(reserved.loanId)
  })

  it('대출이 시작된 기록은 예약 해제로 지울 수 없다', () => {
    const { state, loanId } = lending()
    expect(cancelReservation(state, loanId).ok).toBe(false)
  })
})

describe('대출', () => {
  it('예약을 대출로 바꾸고 반납 예정 시각을 절대 시각으로 정한다', () => {
    const { state, loanId } = lending(3, 3, 1_000)
    expect(bookStatus(state, 'b1')).toBe('ON_LOAN')
    const loan = activeLoan(state, 'b1')
    expect(loan?.id).toBe(loanId)
    expect(loan?.loanedAt).toBe(1_500)
    expect(loan?.dueAt).toBe(1_500 + HOUR)
    expect(onLoanCount(state)).toBe(1)
  })

  it('대출 중에도 도서는 원래 슬롯에 남는다', () => {
    const { state } = lending()
    expect(state.shelf[0]?.id).toBe('b1')
  })

  it('예약 없이 또는 두 번 대출 처리할 수 없다', () => {
    const { state, loanId } = lending()
    expect(startLoan(state, loanId, 0, HOUR).ok).toBe(false)
    expect(startLoan(state, 'loan-99', 0, HOUR).ok).toBe(false)
  })

  it('대출 기간이 올바르지 않으면 거절한다', () => {
    const reserved = must(reserveBook(library(3, 3), 'b1', 0))
    expect(startLoan(reserved.state, reserved.loanId, 0, -1).ok).toBe(false)
    expect(startLoan(reserved.state, reserved.loanId, 0, Number.NaN).ok).toBe(false)
  })
})

describe('만기와 반납 트레이', () => {
  it('반납 예정 시각 전에는 그대로이고 지나면 반납 트레이로 간다', () => {
    const { state } = lending(3, 3, 1_000) // due = 1_500 + HOUR
    expect(settleDueLoans(state, 1_500 + HOUR - 1)).toBe(state)

    const settled = settleDueLoans(state, 1_500 + HOUR)
    expect(bookStatus(settled, 'b1')).toBe('RETURNED')
    expect(returnedCount(settled)).toBe(1)
    expect(settled.shelf[0]?.id).toBe('b1') // 정리 전까지 슬롯 유지
  })

  it('같은 시각으로 여러 번 불러도 결과가 같다', () => {
    const { state } = lending()
    const once = settleDueLoans(state, 10 * HOUR)
    expect(settleDueLoans(once, 10 * HOUR)).toEqual(once)
  })

  it('반납 트레이는 반납 예정 시각 순서로 쌓이고 용량 제한이 없다', () => {
    let state = library(5, 5)
    for (const [id, now] of [['b3', 0], ['b1', 10], ['b2', 20]] as const) {
      const reserved = must(reserveBook(state, id, now))
      state = must(startLoan(reserved.state, reserved.loanId, now, HOUR)).state
    }
    const settled = settleDueLoans(state, 10 * HOUR)
    expect(
      settled.circulation.returnQueue.map((loanId) => settled.circulation.loans.find((l) => l.id === loanId)?.bookId),
    ).toEqual(['b3', 'b1', 'b2'])
    expect(returnedCount(settled)).toBe(3)
  })

  it('반납 대기 중인 도서는 정리 전까지 다시 대출할 수 없다', () => {
    const settled = settleDueLoans(lending().state, 10 * HOUR)
    expect(reserveBook(settled, 'b1', 20 * HOUR).ok).toBe(false)
    expect(availableBookIds(settled)).toEqual(['b2', 'b3'])
  })

  it('정리하면 가장 오래 기다린 도서부터 원래 슬롯에서 다시 대출 가능해진다', () => {
    let state = library(5, 5)
    for (const [id, now] of [['b2', 0], ['b4', 10]] as const) {
      const reserved = must(reserveBook(state, id, now))
      state = must(startLoan(reserved.state, reserved.loanId, now, HOUR)).state
    }
    state = settleDueLoans(state, 10 * HOUR)

    const first = must(sortNextReturned(state, 11 * HOUR))
    expect(first.bookId).toBe('b2')
    expect(bookStatus(first.state, 'b2')).toBe('AVAILABLE')
    expect(bookStatus(first.state, 'b4')).toBe('RETURNED')
    expect(first.state.shelf[1]?.id).toBe('b2') // 원래 위치
    expect(returnedCount(first.state)).toBe(1)

    // 정리를 마친 도서는 바로 다시 대출할 수 있다.
    expect(reserveBook(first.state, 'b2', 12 * HOUR).ok).toBe(true)
  })

  it('정리할 도서가 없으면 그대로다', () => {
    const state = library(3, 3)
    expect(must(sortNextReturned(state, 0))).toEqual({ ok: true, state, bookId: null })
  })

  it('정리를 마친 대출은 이력으로 남는다', () => {
    const settled = settleDueLoans(lending().state, 10 * HOUR)
    const sorted = must(sortNextReturned(settled, 11 * HOUR))
    const loan = sorted.state.circulation.loans[0]
    expect(loan.status).toBe('DONE')
    expect(loan.doneAt).toBe(11 * HOUR)
    expect(activeLoan(sorted.state, 'b1')).toBeUndefined()
  })
})

describe('독서 보상 회수(대출 중 도서)', () => {
  it('진열 중인 도서는 즉시 제거되고 보관함 도서가 올라온다', () => {
    const state = library(2, 3)
    const revoked = revokeBook(state, 'b1')
    expect(revoked.shelf.map((entry) => entry?.id ?? null)).toEqual(['b3', 'b2'])
    expect(revoked.storage).toEqual([])
  })

  it('예약 중인 도서는 예약을 지우고 즉시 제거한다', () => {
    const reserved = must(reserveBook(library(3, 3), 'b1', 0))
    const revoked = revokeBook(reserved.state, 'b1')
    expect(bookStatus(revoked, 'b1')).toBeNull()
    expect(revoked.circulation.loans).toEqual([])
  })

  it('대출 중인 도서는 대출을 유지하고 반납 시점에 제거한다(트레이에 넣지 않는다)', () => {
    const { state } = lending()
    const revoked = revokeBook(state, 'b1')
    expect(bookStatus(revoked, 'b1')).toBe('ON_LOAN') // 대출 취소 없음
    expect(revoked.shelf[0]?.id).toBe('b1')

    const settled = settleDueLoans(revoked, 10 * HOUR)
    expect(bookStatus(settled, 'b1')).toBeNull() // 제거됨
    expect(returnedCount(settled)).toBe(0) // 트레이에 추가하지 않음
    expect(settled.circulation.returnQueue).toEqual([])
    expect(settled.circulation.loans[0].status).toBe('DONE')
  })

  it('반납 때 제거되면 보관함 도서가 그 슬롯으로 올라온다', () => {
    let state = library(2, 3) // b3 보관함
    const reserved = must(reserveBook(state, 'b1', 0))
    state = must(startLoan(reserved.state, reserved.loanId, 0, HOUR)).state
    state = revokeBook(state, 'b1')
    const settled = settleDueLoans(state, HOUR)
    expect(settled.shelf.map((entry) => entry?.id ?? null)).toEqual(['b3', 'b2'])
    expect(settled.storage).toEqual([])
  })

  it('반납 트레이에서 기다리는 도서는 대기열에서 빼고 즉시 제거한다', () => {
    const settled = settleDueLoans(lending().state, 10 * HOUR)
    const revoked = revokeBook(settled, 'b1')
    expect(bookStatus(revoked, 'b1')).toBeNull()
    expect(returnedCount(revoked)).toBe(0)
    expect(revoked.circulation.loans).toEqual([])
  })

  it('회수 표시 뒤 같은 도서가 다시 지급되면 되살린다', () => {
    const { state } = lending()
    const revoked = revokeBook(state, 'b1')
    expect(activeLoan(revoked, 'b1')?.revokeOnReturn).toBe(true)
    const reinstated = reinstateBook(revoked, 'b1')
    expect(activeLoan(reinstated, 'b1')?.revokeOnReturn).toBe(false)
    // 되살린 도서는 만기에 트레이로 간다.
    expect(bookStatus(settleDueLoans(reinstated, 10 * HOUR), 'b1')).toBe('RETURNED')
  })
})

describe('앱 시작 때의 복구(resumeCirculation)', () => {
  it('예약 중이던 기록은 해제되어 도서를 다시 대출할 수 있다', () => {
    const reserved = must(reserveBook(library(3, 3), 'b1', 0))
    const resumed = resumeCirculation(reserved.state, 5)
    expect(bookStatus(resumed, 'b1')).toBe('AVAILABLE')
    expect(resumed.circulation.loans).toEqual([])
  })

  it('대출 중이던 도서는 만기 전이면 그대로 대출 중이다', () => {
    const { state } = lending(3, 3, 1_000)
    const resumed = resumeCirculation(state, 1_500 + HOUR - 1)
    expect(bookStatus(resumed, 'b1')).toBe('ON_LOAN')
  })

  it('앱이 꺼져 있는 동안 만기가 지난 대출은 반납 트레이로 옮긴다', () => {
    const { state } = lending(3, 3, 1_000)
    const resumed = resumeCirculation(state, 1_500 + 3 * HOUR)
    expect(bookStatus(resumed, 'b1')).toBe('RETURNED')
    expect(returnedCount(resumed)).toBe(1)
    expect(activeLoan(resumed, 'b1')?.returnedAt).toBe(1_500 + HOUR) // 반납 시각은 예정 시각
  })
})
