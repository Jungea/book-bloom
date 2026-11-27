import { describe, expect, it } from 'vitest'
import {
  availableBookIds,
  bookStatus,
  reserveBook,
  returnedCount,
  settleDueLoans,
  startLoan,
} from '../core/circulation'
import { createReturnSorter, type ReturnSorter } from '../core/returnSorter'
import { createCirculationHooks, createSortHooks } from './gameCirculation'
import { createGameStore, type GameStore } from './gameStore'
import { restoreGame, toGameSnapshot } from './gameSnapshot'
import { deleteBook, registerBook, startReading } from './reading'

const HOUR = 3_600_000
const SORT_MS = 1000

/** 독서 도서 n권을 등록·시작하고(도서관에 n권) 모두 대출 후 만기가 지나 반납 트레이에 쌓인 저장소. */
function storeWithReturned(count: number): { store: GameStore; readingIds: string[]; libraryIds: string[] } {
  const store = createGameStore(10)
  const readingIds: string[] = []
  for (let i = 1; i <= count; i += 1) {
    const registered = store.apply((game) => registerBook(game, { title: `도서 ${i}`, genre: '문학' }))
    if (!registered.ok) throw new Error(registered.reason)
    readingIds.push(registered.bookId)
    const started = store.apply((game) => startReading(game, registered.bookId))
    if (!started.ok) throw new Error(started.reason)
  }
  const libraryIds = store.getState().library.shelf.flatMap((book) => (book ? [book.id] : []))
  // 도서마다 시각을 달리해 대출·만기 처리: 반납 트레이에는 대출한 순서(반납 예정 시각 순)로 쌓인다.
  libraryIds.forEach((id, index) => {
    store.apply((game) => {
      const reserved = reserveBook(game.library, id, index)
      if (!reserved.ok) throw new Error(reserved.reason)
      const loaned = startLoan(reserved.state, reserved.loanId, index, HOUR)
      if (!loaned.ok) throw new Error(loaned.reason)
      return { ok: true, game: { ...game, library: loaned.state } }
    })
  })
  store.apply((game) => ({ ok: true, game: { ...game, library: settleDueLoans(game.library, 10 * HOUR) } }))
  return { store, readingIds, libraryIds }
}

function makeSorter(store: GameStore): ReturnSorter {
  return createReturnSorter({ sortMs: SORT_MS }, createSortHooks(store, { now: () => 20 * HOUR }))
}

function run(sorter: ReturnSorter, totalMs: number, stepMs = 50) {
  for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) sorter.tick(stepMs)
}

const library = (store: GameStore) => store.getState().library

describe('트레이 정리: 실제 저장소와 연결', () => {
  it('클릭 후 시간이 지나면 가장 오래 기다린 도서부터 책장 원래 자리로 돌아와 다시 대출할 수 있다', () => {
    const { store, libraryIds } = storeWithReturned(3)
    expect(returnedCount(library(store))).toBe(3)
    const slotBefore = library(store).shelf.map((book) => book?.id)

    const sorter = makeSorter(store)
    expect(sorter.click()).toBe('STARTED')
    run(sorter, SORT_MS)

    expect(bookStatus(library(store), libraryIds[0])).toBe('AVAILABLE')
    expect(bookStatus(library(store), libraryIds[1])).toBe('RETURNED')
    expect(returnedCount(library(store))).toBe(2)
    expect(library(store).shelf.map((book) => book?.id)).toEqual(slotBefore) // 원래 위치
    expect(availableBookIds(library(store))).toEqual([libraryIds[0]])
    expect(reserveBook(library(store), libraryIds[0], 30 * HOUR).ok).toBe(true) // 재대출 가능
  })

  it('끝까지 정리하면 모든 도서가 진열 상태로 돌아오고 정지한다', () => {
    const { store } = storeWithReturned(3)
    const sorter = makeSorter(store)
    sorter.click()
    run(sorter, 3 * SORT_MS + 100)
    expect(returnedCount(library(store))).toBe(0)
    expect(availableBookIds(library(store))).toHaveLength(3)
    expect(sorter.isActive()).toBe(false)
  })

  it('정리 중 클릭하면 처리 중인 한 권이 즉시 돌아온다', () => {
    const { store, libraryIds } = storeWithReturned(3)
    const sorter = makeSorter(store)
    sorter.click()
    run(sorter, 300)
    expect(sorter.click()).toBe('SORTED_NOW')
    expect(bookStatus(library(store), libraryIds[0])).toBe('AVAILABLE')
    expect(sorter.getProgress()).toBe(0)
  })

  it('정리 결과는 저장 형식을 거쳐 복원해도 같다', () => {
    const { store } = storeWithReturned(3)
    const sorter = makeSorter(store)
    sorter.click()
    run(sorter, SORT_MS)
    const restored = restoreGame(JSON.parse(JSON.stringify(toGameSnapshot(store.getState()))), 10)
    expect(restored).toEqual({ ok: true, game: store.getState() })
  })
})

describe('트레이 정리: 정리 중 독서 기록 변경으로 도서가 회수되는 경우', () => {
  it('정리 대기 중인 맨 앞 도서가 회수되면 다음 도서로 넘어가고 대기열이 막히지 않는다', () => {
    const { store, readingIds, libraryIds } = storeWithReturned(3)
    const sorter = makeSorter(store)
    sorter.click()
    run(sorter, 600) // 첫 도서를 정리하던 중

    store.apply((game) => deleteBook(game, readingIds[0])) // 맨 앞 도서의 독서 기록 삭제 → 즉시 제거
    expect(bookStatus(library(store), libraryIds[0])).toBeNull()
    expect(returnedCount(library(store))).toBe(2)

    run(sorter, SORT_MS) // 다음 도서가 정리된다
    expect(bookStatus(library(store), libraryIds[1])).toBe('AVAILABLE')
    expect(returnedCount(library(store))).toBe(1)
    expect(sorter.isActive()).toBe(true)

    run(sorter, SORT_MS)
    expect(returnedCount(library(store))).toBe(0)
    expect(sorter.isActive()).toBe(false)
  })

  it('대기 중인 도서가 모두 회수되면 오류 없이 멈추고 새 반납 도서는 다시 클릭해야 정리된다', () => {
    const { store, readingIds } = storeWithReturned(2)
    const sorter = makeSorter(store)
    sorter.click()
    run(sorter, 400)
    readingIds.forEach((id) => store.apply((game) => deleteBook(game, id)))
    expect(returnedCount(library(store))).toBe(0)

    run(sorter, 2000)
    expect(sorter.isActive()).toBe(false)
    expect(sorter.click()).toBe('IGNORED') // 정리할 것이 없다
  })

  it('정리가 시작되기 전에 도서가 회수돼도 대기열이 어긋나지 않는다', () => {
    const { store, readingIds, libraryIds } = storeWithReturned(3)
    store.apply((game) => deleteBook(game, readingIds[1])) // 가운데 도서 회수
    const sorter = makeSorter(store)
    sorter.click()
    run(sorter, 2 * SORT_MS + 100)
    expect(returnedCount(library(store))).toBe(0)
    expect(bookStatus(library(store), libraryIds[0])).toBe('AVAILABLE')
    expect(bookStatus(library(store), libraryIds[2])).toBe('AVAILABLE')
    expect(bookStatus(library(store), libraryIds[1])).toBeNull()
  })
})

describe('트레이 정리: 새 반납 도서가 정리 중에 도착하는 경우', () => {
  it('대기열 끝에 쌓여 같은 정리가 이어서 처리하고, 비면 멈춘다', () => {
    const { store, libraryIds } = storeWithReturned(2)
    // 첫 도서를 정리해 다시 대출 가능하게 한 뒤, 정리 중에 새로 반납되도록 만든다.
    const sorter = makeSorter(store)
    sorter.click()
    run(sorter, SORT_MS)
    expect(bookStatus(library(store), libraryIds[0])).toBe('AVAILABLE')

    const hooks = createCirculationHooks(store, { now: () => 40 * HOUR, random: () => 0, loanDurationMs: HOUR })
    const reserved = hooks.reserve()
    if (!reserved.ok) throw new Error(reserved.reason)
    expect(hooks.startLoan(reserved.loanId).ok).toBe(true)
    store.apply((game) => ({ ok: true, game: { ...game, library: settleDueLoans(game.library, 50 * HOUR) } }))
    expect(returnedCount(library(store))).toBe(2) // 남아 있던 한 권 + 새로 도착한 한 권

    run(sorter, 2 * SORT_MS + 100)
    expect(returnedCount(library(store))).toBe(0)
    expect(sorter.isActive()).toBe(false)
  })
})
