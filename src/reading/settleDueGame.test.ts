import { describe, expect, it, vi } from 'vitest'
import { bookStatus, reserveBook, returnedCount, startLoan } from '../core/circulation'
import { acquireBooks, createLibrary } from '../core/library'
import { expireLoans } from '../debug/circulationActions'
import { settleDueGame } from './gameCirculation'
import { createGameStore } from './gameStore'
import { createGame, type Game } from './reading'

const HOUR = 3_600_000

function lending(dueAfterMs = HOUR): Game {
  const library = acquireBooks(
    createLibrary(4),
    [1, 2, 3].map((n) => ({ id: `b${n}`, title: `도서 ${n}` })),
  )
  const reserved = reserveBook(library, 'b1', 0)
  if (!reserved.ok) throw new Error(reserved.reason)
  const loaned = startLoan(reserved.state, reserved.loanId, 0, dueAfterMs)
  if (!loaned.ok) throw new Error(loaned.reason)
  return createGame(loaned.state)
}

describe('settleDueGame', () => {
  it('만기 전에는 같은 게임 객체를 돌려준다(변경 없음)', () => {
    const game = lending()
    const result = settleDueGame(game, HOUR - 1)
    expect(result.ok && result.game).toBe(game)
  })

  it('만기가 지나면 반납 트레이로 옮긴다', () => {
    const result = settleDueGame(lending(), 2 * HOUR)
    if (!result.ok) throw new Error(result.reason)
    expect(bookStatus(result.game.library, 'b1')).toBe('RETURNED')
    expect(returnedCount(result.game.library)).toBe(1)
  })

  it('같은 시각으로 여러 번 불러도 결과가 같다', () => {
    const once = settleDueGame(lending(), 2 * HOUR)
    if (!once.ok) throw new Error(once.reason)
    const twice = settleDueGame(once.game, 2 * HOUR)
    expect(twice.ok && twice.game).toBe(once.game)
  })

  it('저장소는 옮길 것이 없으면 변경을 알리지 않고 있으면 한 번만 알린다', () => {
    const store = createGameStore(4, lending())
    const listener = vi.fn()
    store.subscribe(listener)

    store.apply((game) => settleDueGame(game, HOUR - 1))
    store.apply((game) => settleDueGame(game, HOUR - 1))
    expect(listener).not.toHaveBeenCalled()

    store.apply((game) => settleDueGame(game, 2 * HOUR))
    store.apply((game) => settleDueGame(game, 2 * HOUR))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(returnedCount(store.getState().library)).toBe(1)
  })
})

describe('expireLoans(개발자 테스트)', () => {
  it('대출 중인 도서의 반납 예정을 지금으로 당겨 반납 트레이로 보낸다', () => {
    const result = expireLoans(lending(10 * HOUR), 5)
    if (!result.ok) throw new Error(result.reason)
    expect(bookStatus(result.game.library, 'b1')).toBe('RETURNED')
    expect(result.game.library.circulation.loans[0].returnedAt).toBe(5)
  })

  it('대출 중이 아닌 도서와 이미 지난 만기는 건드리지 않는다', () => {
    const game = lending()
    const settled = settleDueGame(game, 2 * HOUR)
    if (!settled.ok) throw new Error(settled.reason)
    const result = expireLoans(settled.game, 3 * HOUR)
    if (!result.ok) throw new Error(result.reason)
    expect(returnedCount(result.game.library)).toBe(1)
    expect(bookStatus(result.game.library, 'b2')).toBe('AVAILABLE')
  })
})
