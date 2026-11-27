import {
  hasBook,
  removeBook,
  type Circulation,
  type LibraryState,
  type LoanRecord,
} from './library'

// v0.3 대출·반납 코어. 도서는 대출 중에도 책장 슬롯을 그대로 차지하고(원래 위치 유지, 예약 슬롯은 빈 슬롯이 아님),
// 이 모듈이 `circulation` 기록으로 상태를 구분한다. Phaser·React와 무관하며 시각은 모두 인자로 받는다.

/** 도서 한 권의 현재 상태. STORED는 보관함에 있어 대출할 수 없는 도서다. */
export type BookStatus = 'AVAILABLE' | 'RESERVED' | 'ON_LOAN' | 'RETURNED' | 'STORED'

export type CirculationResult<T = object> =
  | ({ readonly ok: true; readonly state: LibraryState } & T)
  | { readonly ok: false; readonly reason: string }

const fail = (reason: string) => ({ ok: false, reason }) as const

function withCirculation(state: LibraryState, circulation: Circulation): LibraryState {
  return { ...state, circulation }
}

function isActive(loan: LoanRecord): boolean {
  return loan.status !== 'DONE'
}

/** 아직 정리가 끝나지 않은(예약·대출·반납 대기) 대출 기록. 없으면 undefined. */
export function activeLoan(state: LibraryState, bookId: string): LoanRecord | undefined {
  return state.circulation.loans.find((loan) => loan.bookId === bookId && isActive(loan))
}

export function findLoan(state: LibraryState, loanId: string): LoanRecord | undefined {
  return state.circulation.loans.find((loan) => loan.id === loanId)
}

export function bookStatus(state: LibraryState, bookId: string): BookStatus | null {
  if (state.storage.some((book) => book.id === bookId)) return 'STORED'
  if (!state.shelf.some((book) => book?.id === bookId)) return null
  const loan = activeLoan(state, bookId)
  return loan ? (loan.status as BookStatus) : 'AVAILABLE'
}

/** 대출할 수 있는 도서(책장에 진열되어 있고 기록이 없는 도서)를 슬롯 순서대로. */
export function availableBookIds(state: LibraryState): string[] {
  return state.shelf
    .filter((book): book is NonNullable<typeof book> => book !== null)
    .filter((book) => !activeLoan(state, book.id))
    .map((book) => book.id)
}

export function onLoanCount(state: LibraryState): number {
  return state.circulation.loans.filter((loan) => loan.status === 'ON_LOAN').length
}

/** 반납 트레이에서 정리를 기다리는 도서 수. */
export function returnedCount(state: LibraryState): number {
  return state.circulation.returnQueue.length
}

function replaceLoan(state: LibraryState, next: LoanRecord): LibraryState {
  const loans = state.circulation.loans.map((loan) => (loan.id === next.id ? next : loan))
  return withCirculation(state, { ...state.circulation, loans })
}

/** 손님이 도서를 고르는 즉시 예약한다. 다른 손님은 같은 도서를 고를 수 없다. */
export function reserveBook(
  state: LibraryState,
  bookId: string,
  nowMs: number,
): CirculationResult<{ readonly loanId: string }> {
  const status = bookStatus(state, bookId)
  if (status === null) return fail('도서관에 없는 도서입니다.')
  if (status === 'STORED') return fail('보관함 도서는 대출할 수 없습니다.')
  if (status !== 'AVAILABLE') return fail('이미 예약·대출 중이거나 반납 정리를 기다리는 도서입니다.')

  const loanId = `loan-${state.circulation.nextSeq}`
  const record: LoanRecord = {
    id: loanId,
    bookId,
    status: 'RESERVED',
    reservedAt: nowMs,
    loanedAt: null,
    dueAt: null,
    returnedAt: null,
    doneAt: null,
    revokeOnReturn: false,
  }
  return {
    ok: true,
    loanId,
    state: withCirculation(state, {
      ...state.circulation,
      loans: [...state.circulation.loans, record],
      nextSeq: state.circulation.nextSeq + 1,
    }),
  }
}

/** 예약을 해제한다. 도서는 다시 대출할 수 있다. 손님이 대출을 포기하거나 앱이 예약 중에 종료됐을 때 쓴다. */
export function cancelReservation(state: LibraryState, loanId: string): CirculationResult {
  const loan = findLoan(state, loanId)
  if (!loan || loan.status !== 'RESERVED') return fail('예약 중인 기록이 아닙니다.')
  return {
    ok: true,
    state: withCirculation(state, {
      ...state.circulation,
      loans: state.circulation.loans.filter((other) => other.id !== loanId),
    }),
  }
}

/** 대출 처리를 완료한다. 반납 예정 시각은 완료 시각에 대출 기간을 더한 절대 시각이다. */
export function startLoan(
  state: LibraryState,
  loanId: string,
  nowMs: number,
  loanDurationMs: number,
): CirculationResult {
  const loan = findLoan(state, loanId)
  if (!loan || loan.status !== 'RESERVED') return fail('예약 중인 기록만 대출할 수 있습니다.')
  if (!Number.isFinite(loanDurationMs) || loanDurationMs < 0) return fail('대출 기간이 올바르지 않습니다.')
  return {
    ok: true,
    state: replaceLoan(state, {
      ...loan,
      status: 'ON_LOAN',
      loanedAt: nowMs,
      dueAt: nowMs + loanDurationMs,
    }),
  }
}

/**
 * 반납 예정 시각이 지난 대출을 처리한다. 앱 시작, 독서 관리에서 도서관으로 돌아올 때, 주기적으로 부른다.
 * - 일반 도서: 반납 트레이(정리 대기)로 옮긴다. 반납 시각은 반납 예정 시각이다. 같은 시각이면 대출 순서를 따른다.
 * - 대출 중에 독서 보상이 회수된 도서: 트레이에 넣지 않고 도서관에서 제거한다.
 * 같은 시각으로 여러 번 불러도 결과가 같다.
 */
export function settleDueLoans(state: LibraryState, nowMs: number): LibraryState {
  const due = state.circulation.loans
    .filter((loan) => loan.status === 'ON_LOAN' && loan.dueAt !== null && loan.dueAt <= nowMs)
    .sort((a, b) => (a.dueAt as number) - (b.dueAt as number))
  if (due.length === 0) return state

  let library = state
  let loans = state.circulation.loans
  const queue = [...state.circulation.returnQueue]
  const settle = (next: LoanRecord) => {
    loans = loans.map((loan) => (loan.id === next.id ? next : loan))
  }

  for (const loan of due) {
    const returnedAt = loan.dueAt as number
    if (loan.revokeOnReturn) {
      settle({ ...loan, status: 'DONE', returnedAt, doneAt: returnedAt })
      library = removeBook(library, loan.bookId)
    } else {
      settle({ ...loan, status: 'RETURNED', returnedAt })
      queue.push(loan.id)
    }
  }
  return withCirculation(library, { ...library.circulation, loans, returnQueue: queue })
}

/**
 * 반납 트레이에서 가장 오래 기다린 도서 한 권을 정리해 책장 원래 위치로 되돌린다.
 * 정리가 끝난 도서는 곧바로 다시 대출할 수 있다. 대기열이 비어 있으면 그대로 돌려준다.
 */
export function sortNextReturned(
  state: LibraryState,
  nowMs: number,
): CirculationResult<{ readonly bookId: string | null }> {
  const [loanId, ...rest] = state.circulation.returnQueue
  if (loanId === undefined) return { ok: true, state, bookId: null }
  const loan = findLoan(state, loanId)
  if (!loan || loan.status !== 'RETURNED') return fail('반납 대기열과 대출 기록이 맞지 않습니다.')
  const next = replaceLoan(state, { ...loan, status: 'DONE', doneAt: nowMs })
  return {
    ok: true,
    bookId: loan.bookId,
    state: withCirculation(next, { ...next.circulation, returnQueue: rest }),
  }
}

/**
 * 독서 보상 회수로 도서를 없앤다.
 * - 진열 중: 즉시 제거(보관함 도서가 있으면 그 자리로 올라온다).
 * - 예약 중: 예약을 취소하고 즉시 제거. 대출이 시작되기 전이다.
 * - 반납 트레이 대기 중: 대기열에서 빼고 즉시 제거.
 * - 대출 중: 대출을 취소하지 않고 반납 시점에 제거하도록 표시만 한다(트레이에 넣지 않는다).
 */
export function revokeBook(state: LibraryState, bookId: string): LibraryState {
  const loan = activeLoan(state, bookId)
  if (loan?.status === 'ON_LOAN') {
    return replaceLoan(state, { ...loan, revokeOnReturn: true })
  }

  let current = state
  if (loan) {
    // 예약 중이거나 트레이에서 기다리는 기록은 도서와 함께 지운다.
    current = withCirculation(current, {
      ...current.circulation,
      loans: current.circulation.loans.filter((other) => other.id !== loan.id),
      returnQueue: current.circulation.returnQueue.filter((id) => id !== loan.id),
    })
  }
  return hasBook(current, bookId) ? removeBook(current, bookId) : current
}

/**
 * 앱 시작(저장 복원 직후) 때 대출 기록을 현재 상태에 맞춘다.
 * - 예약 중인 기록은 모두 해제한다. 손님은 저장하지 않으므로 예약을 이어갈 주체가 없다.
 * - 반납 예정 시각이 지난 대출은 반납 트레이로 옮긴다(재실행 사이의 경과 반영).
 */
export function resumeCirculation(state: LibraryState, nowMs: number): LibraryState {
  const reserved = state.circulation.loans.filter((loan) => loan.status === 'RESERVED')
  let current = state
  if (reserved.length > 0) {
    const ids = new Set(reserved.map((loan) => loan.id))
    current = withCirculation(current, {
      ...current.circulation,
      loans: current.circulation.loans.filter((loan) => !ids.has(loan.id)),
    })
  }
  return settleDueLoans(current, nowMs)
}

/**
 * 대출 중에 회수 표시가 된 도서를 같은 도서가 다시 지급될 때(완독 취소 후 재완독 등) 되살린다.
 * 회수 표시가 없거나 대출 중이 아니면 그대로 돌려준다.
 */
export function reinstateBook(state: LibraryState, bookId: string): LibraryState {
  const loan = activeLoan(state, bookId)
  if (loan?.status !== 'ON_LOAN' || !loan.revokeOnReturn) return state
  return replaceLoan(state, { ...loan, revokeOnReturn: false })
}
