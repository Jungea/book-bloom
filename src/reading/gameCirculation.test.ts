import { describe, expect, it, vi } from 'vitest'
import { availableBookIds, bookStatus, onLoanCount } from '../core/circulation'
import { createVisitorWorld, type VisitorWorld } from '../core/visitorWorld'
import type { VisitorConfig } from '../core/visitors'
import { createCirculationHooks } from './gameCirculation'
import { createGameStore, type GameStore } from './gameStore'
import { deleteBook, registerBook, startReading } from './reading'

const HOUR = 3_600_000

const config: VisitorConfig = {
  speed: 200,
  browseMs: 500,
  checkoutMs: 500,
  firstSpawnMs: 99_999,
  spawnIntervalMs: 99_999,
  maxVisitors: 3,
  entrance: { x: 400, y: 500 },
  corridorY: 300,
  spots: [
    { x: 200, y: 260 },
    { x: 160, y: 270 },
    { x: 240, y: 270 },
  ],
  deskSlots: [
    { x: 80, y: 266 },
    { x: 114, y: 266 },
    { x: 148, y: 266 },
  ],
}

/** 도서 n권을 등록·시작해 도서관에 n권을 만든 저장소. 독서 도서 id는 book-1, book-2… 순이다. */
function storeWithBooks(count: number, capacity = 10): GameStore {
  const store = createGameStore(capacity)
  for (let i = 1; i <= count; i += 1) {
    const registered = store.apply((game) => registerBook(game, { title: `도서 ${i}`, genre: '문학' }))
    if (!registered.ok) throw new Error(registered.reason)
    const started = store.apply((game) => startReading(game, registered.bookId))
    if (!started.ok) throw new Error(started.reason)
  }
  return store
}

function setup(store: GameStore, now = () => 1_000, random = () => 0) {
  const hooks = createCirculationHooks(store, { now, random, loanDurationMs: HOUR })
  const world = createVisitorWorld(config, hooks)
  return { world, hooks }
}

function run(world: VisitorWorld, totalMs: number, stepMs = 50) {
  for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) world.tick(stepMs)
}

const library = (store: GameStore) => store.getState().library

describe('createCirculationHooks: 손님이 실제 저장소에서 책을 빌린다', () => {
  it('손님이 책을 골라 예약하고, 대출 처리를 마치면 대출이 시작된다(절대 반납 예정 시각)', () => {
    const store = storeWithBooks(2)
    const { world } = setup(store, () => 5_000)
    world.spawn()

    // 구경이 끝나 도서를 고른 시점: 예약, 책장 위치는 그대로.
    for (let i = 0; i < 400 && !world.getVisitors().some((visitor) => visitor.book); i += 1) world.tick(50)
    const carried = world.getVisitors()[0].book
    expect(carried?.started).toBe(false)
    expect(bookStatus(library(store), carried?.bookId ?? '')).toBe('RESERVED')
    expect(library(store).shelf[0]?.id).toBe('lib:start:book-1')

    run(world, 30_000)
    expect(world.getVisitors()).toHaveLength(0)
    expect(bookStatus(library(store), 'lib:start:book-1')).toBe('ON_LOAN')
    expect(library(store).circulation.loans[0]).toMatchObject({ loanedAt: 5_000, dueAt: 5_000 + HOUR })
  })

  it('고르는 도서는 대출 가능한 진열 도서뿐이고 난수로 고른다', () => {
    const store = storeWithBooks(4)
    const { world } = setup(store, () => 0, () => 0.99) // 마지막 후보
    world.spawn()
    run(world, 30_000)
    const lastShelved = library(store).shelf[3]?.id ?? ''
    expect(bookStatus(library(store), lastShelved)).toBe('ON_LOAN') // 난수 0.99는 마지막 후보
    expect(onLoanCount(library(store))).toBe(1)
  })

  it('여러 손님이 같은 도서를 고르지 않는다', () => {
    const store = storeWithBooks(3)
    const { world } = setup(store)
    world.spawn()
    world.spawn()
    world.spawn()
    run(world, 60_000)
    const bookIds = library(store).circulation.loans.map((loan) => loan.bookId)
    expect(new Set(bookIds).size).toBe(bookIds.length)
    expect(onLoanCount(library(store))).toBe(3)
    expect(availableBookIds(library(store))).toEqual([])
  })

  it('대출 가능한 도서가 없으면 책을 고르지 않고 퇴장하며 상태는 그대로다', () => {
    const store = storeWithBooks(0)
    const { world } = setup(store)
    world.spawn()
    run(world, 30_000)
    expect(world.getVisitors()).toHaveLength(0)
    expect(library(store).circulation.loans).toEqual([])
  })

  it('보관함 도서는 고르지 않는다', () => {
    const store = storeWithBooks(3, 1) // 책장 1칸, 나머지 2권은 보관함
    const { world } = setup(store)
    world.spawn()
    world.spawn()
    run(world, 60_000)
    expect(onLoanCount(library(store))).toBe(1) // 진열된 한 권만 빌려 갈 수 있다
  })

  it('이미 대출 중인 도서는 다시 고르지 않는다', () => {
    const store = storeWithBooks(1)
    const { world } = setup(store)
    world.spawn()
    run(world, 30_000)
    expect(onLoanCount(library(store))).toBe(1)

    world.spawn() // 다음 손님: 빌릴 책이 없다
    run(world, 30_000)
    expect(onLoanCount(library(store))).toBe(1)
    expect(library(store).circulation.loans).toHaveLength(1)
  })
})

describe('createCirculationHooks: 예약한 뒤 독서 기록 변경으로 책이 회수되는 경우', () => {
  it('책을 고른 뒤 회수되면 대출 시작이 실패하고, 손님은 줄을 막지 않고 한 번만 시도한 뒤 책 없이 퇴장한다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = storeWithBooks(1)
    const { world, hooks } = setup(store)
    const startLoan = vi.spyOn(hooks, 'startLoan')
    world.spawn()

    // 책을 고른 시점에서 독서 기록을 지워 보상을 회수한다.
    for (let i = 0; i < 400 && !world.getVisitors().some((visitor) => visitor.book); i += 1) world.tick(50)
    expect(bookStatus(library(store), 'lib:start:book-1')).toBe('RESERVED')
    store.apply((game) => deleteBook(game, 'book-1'))
    expect(bookStatus(library(store), 'lib:start:book-1')).toBeNull() // 예약이 지워지고 즉시 제거됨

    let leavingWithBook = false
    for (let i = 0; i < 1000 && world.getVisitors().length > 0; i += 1) {
      world.tick(50)
      if (world.getVisitors().some((visitor) => visitor.phase === 'LEAVING' && visitor.book)) leavingWithBook = true
    }
    expect(world.getVisitors()).toHaveLength(0)
    expect(world.getDeskQueue()).toEqual([])
    expect(leavingWithBook).toBe(false)
    expect(startLoan).toHaveBeenCalledTimes(1) // 오류를 반복하지 않는다
    expect(library(store).circulation.loans).toEqual([])
    expect(onLoanCount(library(store))).toBe(0)
  })

  it('회수된 도서를 기다리던 손님 뒤의 다음 손님은 지체 없이 처리된다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = storeWithBooks(2)
    const { world } = setup(store)
    world.spawn()
    world.spawn()

    // 두 손님이 모두 책을 고를 때까지 진행한 뒤 첫 번째 도서를 회수한다.
    for (let i = 0; i < 800 && world.getVisitors().filter((visitor) => visitor.book).length < 2; i += 1) world.tick(50)
    const firstBook = world.getVisitors().find((visitor) => visitor.book)?.book?.bookId ?? ''
    const readingBookId = firstBook.replace('lib:start:', '') // 독서 도서 id
    store.apply((game) => deleteBook(game, readingBookId))

    run(world, 60_000)
    expect(world.getVisitors()).toHaveLength(0)
    expect(world.getDeskQueue()).toEqual([])
    // 회수되지 않은 도서 한 권은 정상적으로 대출되었다.
    expect(onLoanCount(library(store))).toBe(1)
  })

  it('대출 중에 회수되면 대출은 유지되고 반납 때 제거된다(1단계 규칙과 연결)', () => {
    const store = storeWithBooks(1)
    const { world } = setup(store)
    world.spawn()
    run(world, 30_000)
    expect(bookStatus(library(store), 'lib:start:book-1')).toBe('ON_LOAN')

    store.apply((game) => deleteBook(game, 'book-1'))
    expect(bookStatus(library(store), 'lib:start:book-1')).toBe('ON_LOAN') // 취소하지 않음
  })
})

describe('createCirculationHooks: 월드를 비울 때', () => {
  it('예약만 된 도서는 예약이 해제되어 다시 대출할 수 있다', () => {
    const store = storeWithBooks(1)
    const { world } = setup(store)
    world.spawn()
    for (let i = 0; i < 400 && !world.getVisitors().some((visitor) => visitor.book); i += 1) world.tick(50)
    expect(bookStatus(library(store), 'lib:start:book-1')).toBe('RESERVED')

    world.clear()
    expect(bookStatus(library(store), 'lib:start:book-1')).toBe('AVAILABLE')
    expect(library(store).circulation.loans).toEqual([])
  })
})
