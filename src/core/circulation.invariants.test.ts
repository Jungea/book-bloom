import { describe, expect, it } from 'vitest'
import {
  activeLoan,
  availableBookIds,
  cancelReservation,
  reinstateBook,
  reserveBook,
  revokeBook,
  settleDueLoans,
  sortNextReturned,
  startLoan,
} from './circulation'
import { acquireBook, createLibrary, type LibraryState } from './library'
import { restoreGame, toGameSnapshot } from '../reading/gameSnapshot'
import { createGame } from '../reading/reading'

/** 시드로 같은 순서를 만드는 간단한 난수. */
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

const pick = <T,>(items: readonly T[], next: () => number): T | undefined =>
  items.length === 0 ? undefined : items[Math.floor(next() * items.length)]

/** 어떤 연산 순서에서도 깨지면 안 되는 대출 상태의 불변식. 어긋나면 이유를 돌려준다. */
export function violations(state: LibraryState): string[] {
  const found: string[] = []
  const shelfIds = state.shelf.flatMap((book) => (book ? [book.id] : []))
  const storageIds = state.storage.map((book) => book.id)
  const all = [...shelfIds, ...storageIds]
  if (new Set(all).size !== all.length) found.push('도서 id가 책장·보관함에 중복되어 있다')
  if (state.shelf.length !== state.shelfCapacity) found.push('책장 슬롯 수가 용량과 다르다')

  const { loans, returnQueue, nextSeq } = state.circulation
  const loanIds = loans.map((loan) => loan.id)
  if (new Set(loanIds).size !== loanIds.length) found.push('대출 기록 id가 중복되어 있다')
  for (const id of loanIds) {
    const number = Number(/^loan-(\d+)$/.exec(id)?.[1])
    if (!(number < nextSeq)) found.push(`다음 대출 번호(${nextSeq})가 ${id}보다 크지 않다`)
  }

  const active = loans.filter((loan) => loan.status !== 'DONE')
  const activeBooks = active.map((loan) => loan.bookId)
  if (new Set(activeBooks).size !== activeBooks.length) found.push('한 도서에 진행 중인 기록이 둘 이상이다')
  for (const loan of active) {
    if (!shelfIds.includes(loan.bookId)) found.push(`${loan.id}의 도서가 책장에 없다(슬롯 유지 위반)`)
  }

  const returned = active.filter((loan) => loan.status === 'RETURNED').map((loan) => loan.id)
  if (new Set(returnQueue).size !== returnQueue.length) found.push('반납 대기열에 중복이 있다')
  if (returnQueue.length !== returned.length || !returnQueue.every((id) => returned.includes(id))) {
    found.push('반납 대기열이 반납 대기 기록과 다르다')
  }

  for (const loan of loans) {
    if (loan.status === 'RESERVED' && (loan.loanedAt !== null || loan.dueAt !== null)) found.push(`${loan.id} 예약에 대출 시각이 있다`)
    if (loan.status === 'ON_LOAN' && (loan.dueAt === null || loan.returnedAt !== null)) found.push(`${loan.id} 대출 중 시각이 맞지 않다`)
    if (loan.status === 'RETURNED' && loan.returnedAt === null) found.push(`${loan.id} 반납 시각이 없다`)
    if (loan.status === 'DONE' && loan.doneAt === null) found.push(`${loan.id} 정리 시각이 없다`)
    if (loan.revokeOnReturn && loan.status !== 'ON_LOAN' && loan.status !== 'DONE') {
      found.push(`${loan.id} 회수 표시가 대출 중이 아닌 기록에 있다`)
    }
  }

  // 진열 도서의 상태는 AVAILABLE이거나 진행 중인 기록 하나로 정해진다.
  for (const id of availableBookIds(state)) {
    if (activeLoan(state, id)) found.push(`${id}가 대출 가능인데 진행 중인 기록이 있다`)
  }
  return found
}

describe('대출 코어 불변식: 무작위 연산 순서', () => {
  const CAPACITY = 5
  /** 무작위 연산이 실제로 여러 상태를 거쳤는지 확인하려고 모아 둔다. */
  const reached = { RESERVED: 0, ON_LOAN: 0, RETURNED: 0, DONE: 0, REVOKED_ON_LOAN: 0, SORTED: 0 }

  for (const seed of [1, 7, 42, 2026, 99991]) {
    it(`시드 ${seed}: 어떤 순서로 연산해도 불변식이 깨지지 않고 저장·복원이 같다`, () => {
      const next = random(seed)
      let state = createLibrary(CAPACITY)
      let now = 0
      let serial = 0

      for (let step = 0; step < 400; step += 1) {
        const operation = Math.floor(next() * 9)
        switch (operation) {
          case 0: {
            serial += 1
            state = acquireBook(state, { id: `n${serial}`, title: `도서 ${serial}` })
            break
          }
          case 1: {
            const id = pick(availableBookIds(state), next)
            if (id) {
              const result = reserveBook(state, id, now)
              if (result.ok) state = result.state
            }
            break
          }
          case 2: {
            const loan = pick(state.circulation.loans.filter((l) => l.status === 'RESERVED'), next)
            if (loan) {
              const result = cancelReservation(state, loan.id)
              if (result.ok) state = result.state
            }
            break
          }
          case 3: {
            const loan = pick(state.circulation.loans.filter((l) => l.status === 'RESERVED'), next)
            if (loan) {
              const result = startLoan(state, loan.id, now, 1 + Math.floor(next() * 5))
              if (result.ok) state = result.state
            }
            break
          }
          case 4: {
            now += Math.floor(next() * 4)
            state = settleDueLoans(state, now)
            break
          }
          case 5: {
            const result = sortNextReturned(state, now)
            if (result.ok) state = result.state
            break
          }
          case 6: {
            const ids = [...state.shelf.flatMap((b) => (b ? [b.id] : [])), ...state.storage.map((b) => b.id)]
            const id = pick(ids, next)
            if (id) state = revokeBook(state, id)
            break
          }
          case 7: {
            const id = pick(state.shelf.flatMap((b) => (b ? [b.id] : [])), next)
            if (id) state = reinstateBook(state, id)
            break
          }
          default: {
            // 같은 시각으로 다시 처리해도 결과가 같다.
            expect(settleDueLoans(state, now)).toEqual(settleDueLoans(settleDueLoans(state, now), now))
          }
        }

        expect(violations(state), `시드 ${seed} 단계 ${step} 연산 ${operation}`).toEqual([])
        for (const loan of state.circulation.loans) {
          reached[loan.status] += 1
          if (loan.revokeOnReturn) reached.REVOKED_ON_LOAN += 1
        }
        if (operation === 5) reached.SORTED += 1

        // 저장 형식을 거쳐도 같은 상태로 복원된다.
        if (step % 10 === 0) {
          const game = createGame(state)
          const restored = restoreGame(JSON.parse(JSON.stringify(toGameSnapshot(game))), CAPACITY)
          expect(restored, `시드 ${seed} 단계 ${step} 복원`).toEqual({ ok: true, game })
        }
      }
    })
  }

  it('무작위 연산이 예약·대출·반납 대기·정리·회수 표시 상태를 모두 거쳤다', () => {
    for (const [name, count] of Object.entries(reached)) {
      expect(count, `${name} 상태에 도달하지 못했다`).toBeGreaterThan(0)
    }
  })

  it('불변식 검사 자체가 어긋난 상태를 잡아낸다', () => {
    const base = createLibrary(3)
    const withBook = acquireBook(base, { id: 'a', title: 'A' })
    const reserved = reserveBook(withBook, 'a', 0)
    if (!reserved.ok) throw new Error(reserved.reason)
    expect(violations(reserved.state)).toEqual([])

    // 진행 중인 기록의 도서가 책장에서 사라졌다.
    const broken: LibraryState = { ...reserved.state, shelf: [null, null, null] }
    expect(violations(broken).join()).toContain('책장에 없다')
    // 반납 대기열이 기록과 다르다.
    const queueBroken: LibraryState = {
      ...reserved.state,
      circulation: { ...reserved.state.circulation, returnQueue: ['loan-1'] },
    }
    expect(violations(queueBroken).join()).toContain('반납 대기열')
  })
})
