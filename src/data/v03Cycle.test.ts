import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activeLoan,
  availableBookIds,
  bookStatus,
  onLoanCount,
  returnedCount,
} from '../core/circulation'
import { createReturnSorter, type ReturnSorter } from '../core/returnSorter'
import { createVisitorWorld, type VisitorWorld } from '../core/visitorWorld'
import type { VisitorConfig } from '../core/visitors'
import { createCirculationHooks, createSortHooks, settleDueGame } from '../reading/gameCirculation'
import { createGameStore, type GameStore } from '../reading/gameStore'
import type { GameSnapshot } from '../reading/gameSnapshot'
import { deleteBook, registerBook, startReading } from '../reading/reading'
import type { GameStorage } from './gameStorage'
import { loadGame } from './loadGame'
import { attachPersistence } from './persistGame'

const HOUR = 3_600_000
const LOAN_MS = HOUR
const SORT_MS = 1000
const CAPACITY = 6

const config: VisitorConfig = {
  speed: 300,
  browseMs: 300,
  checkoutMs: 300,
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

/** IndexedDB처럼 값을 복제해 보관하는 메모리 저장소. */
function memoryDisk() {
  let stored: unknown = null
  const storage: GameStorage = {
    load: async () => (stored === null ? null : structuredClone(stored)),
    save: async (snapshot: GameSnapshot) => {
      stored = structuredClone(snapshot)
    },
    clear: async () => {
      stored = null
    },
    quarantine: async () => {},
  }
  return { storage, peek: () => stored as GameSnapshot | null }
}

interface Session {
  store: GameStore
  world: VisitorWorld
  sorter: ReturnSorter
  flush: () => Promise<void>
}

/** 앱 한 번 실행. Shell이 하는 일(복원, 저장 연결, 복구 저장, 손님·정리 연결)을 그대로 따른다. */
async function launch(storage: GameStorage, nowMs: number): Promise<Session> {
  const loaded = await loadGame(storage, CAPACITY, nowMs)
  if (!loaded.ok) throw new Error(loaded.message)
  const store = createGameStore(CAPACITY, loaded.game)
  const persistence = attachPersistence(store, storage, (error) => {
    throw error
  })
  if (loaded.recovered) void persistence.saveNow()
  const world = createVisitorWorld(
    config,
    createCirculationHooks(store, { now: () => nowMs, random: () => 0, loanDurationMs: LOAN_MS }),
  )
  const sorter = createReturnSorter({ sortMs: SORT_MS }, createSortHooks(store, { now: () => nowMs }))
  return { store, world, sorter, flush: persistence.flush }
}

function addBooks(store: GameStore, count: number): string[] {
  const ids: string[] = []
  for (let i = 0; i < count; i += 1) {
    const registered = store.apply((game) => registerBook(game, { title: `도서 ${store.getState().reading.nextSeq}`, genre: '문학' }))
    if (!registered.ok) throw new Error(registered.reason)
    ids.push(registered.bookId)
    const started = store.apply((game) => startReading(game, registered.bookId))
    if (!started.ok) throw new Error(started.reason)
  }
  return ids
}

function runWorld(world: VisitorWorld, ms: number, step = 50) {
  for (let elapsed = 0; elapsed < ms; elapsed += step) world.tick(step)
}

function runSorter(sorter: ReturnSorter, ms: number, step = 50) {
  for (let elapsed = 0; elapsed < ms; elapsed += step) sorter.tick(step)
}

/** 손님 n명이 들어와 책을 빌려 나갈 때까지 진행한다. */
function lendTo(session: Session, visitors: number) {
  for (let i = 0; i < visitors; i += 1) session.world.spawn()
  runWorld(session.world, 30_000)
  expect(session.world.getVisitors()).toHaveLength(0)
}

const library = (session: Session) => session.store.getState().library

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('v0.3 전체 순환: 대출 → 저장 → 재실행 → 만기 → 정리 → 재대출', () => {
  it('손님이 책을 빌리고, 재실행 사이 만기가 지나 트레이에 쌓이고, 정리해 다시 빌릴 수 있다', async () => {
    const disk = memoryDisk()
    const first = await launch(disk.storage, 1_000)
    addBooks(first.store, 3) // 책 3권(시작 보상)
    expect(availableBookIds(library(first))).toHaveLength(3)

    lendTo(first, 2)
    expect(onLoanCount(library(first))).toBe(2)
    expect(availableBookIds(library(first))).toHaveLength(1)
    await first.flush()

    // 만기 전 재실행: 대출 중이 그대로 복원된다.
    const midway = await launch(disk.storage, 1_000 + LOAN_MS - 1)
    expect(onLoanCount(library(midway))).toBe(2)
    expect(returnedCount(library(midway))).toBe(0)

    // 만기 후 재실행: 반납 트레이에 쌓이고 저장소에도 반영된다(첫 변경 전).
    const later = await launch(disk.storage, 1_000 + 3 * LOAN_MS)
    expect(returnedCount(library(later))).toBe(2)
    await later.flush()
    expect(disk.peek()?.library.circulation.returnQueue).toHaveLength(2)

    // 정리 전에는 다시 빌릴 수 없고, 정리하면 원래 자리에서 다시 빌릴 수 있다.
    expect(availableBookIds(library(later))).toHaveLength(1)
    later.sorter.click()
    runSorter(later.sorter, 2 * SORT_MS + 100)
    expect(returnedCount(library(later))).toBe(0)
    expect(availableBookIds(library(later))).toHaveLength(3)

    lendTo(later, 3)
    expect(onLoanCount(library(later))).toBe(3)
    await later.flush()

    // 정리 결과와 두 번째 대출도 저장·복원된다.
    const again = await launch(disk.storage, 1_000 + 3 * LOAN_MS + 10)
    expect(onLoanCount(library(again))).toBe(3)
    expect(returnedCount(library(again))).toBe(0)
    expect(library(again).circulation.loans.filter((loan) => loan.status === 'DONE')).toHaveLength(2) // 정리를 마친 이력
  })

  it('보관함 도서는 빌릴 수 없고, 반납 도서를 정리해도 책장 슬롯 순서는 그대로다', async () => {
    const disk = memoryDisk()
    const session = await launch(disk.storage, 0)
    addBooks(session.store, 8) // 책장 6칸, 2권은 보관함
    expect(library(session).storage).toHaveLength(2)
    const slotsBefore = library(session).shelf.map((book) => book?.id)

    lendTo(session, 3)
    expect(onLoanCount(library(session))).toBe(3)
    for (const loan of library(session).circulation.loans) {
      expect(library(session).storage.some((book) => book.id === loan.bookId)).toBe(false)
    }

    session.store.apply((game) => settleDueGame(game, 10 * HOUR))
    session.sorter.click()
    runSorter(session.sorter, 3 * SORT_MS + 100)
    expect(library(session).shelf.map((book) => book?.id)).toEqual(slotsBefore)
    expect(library(session).storage).toHaveLength(2)
  })
})

describe('v0.3 앱 종료·회수 시나리오', () => {
  it('손님이 책을 고른 채(예약만) 앱이 종료되면 재실행 때 예약이 풀려 다시 빌릴 수 있다', async () => {
    const disk = memoryDisk()
    const first = await launch(disk.storage, 0)
    addBooks(first.store, 1)
    first.world.spawn()
    // 책을 고르고 줄에 선 시점까지만 진행한다(대출 처리 전).
    for (let i = 0; i < 400 && !first.world.getVisitors().some((visitor) => visitor.book); i += 1) first.world.tick(50)
    expect(bookStatus(library(first), 'lib:start:book-1')).toBe('RESERVED')
    await first.flush()

    const second = await launch(disk.storage, 100)
    expect(bookStatus(library(second), 'lib:start:book-1')).toBe('AVAILABLE')
    await second.flush()
    expect(disk.peek()?.library.circulation.loans).toEqual([]) // 저장소도 예약이 지워진 상태

    lendTo(second, 1)
    expect(onLoanCount(library(second))).toBe(1)
  })

  it('대출 중에 독서 기록이 지워지면 대출은 유지되고 반납 때 제거되며 트레이에 쌓이지 않는다', async () => {
    const disk = memoryDisk()
    const first = await launch(disk.storage, 0)
    const [bookId] = addBooks(first.store, 2)
    lendTo(first, 1)
    const borrowed = library(first).circulation.loans[0].bookId
    expect(borrowed).toBe('lib:start:book-1')

    first.store.apply((game) => deleteBook(game, bookId))
    expect(bookStatus(library(first), borrowed)).toBe('ON_LOAN')
    expect(activeLoan(library(first), borrowed)?.revokeOnReturn).toBe(true)
    await first.flush()

    const later = await launch(disk.storage, 5 * HOUR)
    expect(bookStatus(library(later), borrowed)).toBeNull()
    expect(returnedCount(library(later))).toBe(0)
    later.sorter.click()
    expect(later.sorter.isActive()).toBe(false) // 정리할 것이 없다
    // 나머지 책은 정상적으로 빌릴 수 있다.
    lendTo(later, 1)
    expect(onLoanCount(library(later))).toBe(1)
  })

  it('정리 중 독서 기록이 지워져도 정리가 막히지 않고 다음 도서로 넘어간다', async () => {
    const disk = memoryDisk()
    const session = await launch(disk.storage, 0)
    const readingIds = addBooks(session.store, 3)
    lendTo(session, 3)
    session.store.apply((game) => settleDueGame(game, 10 * HOUR))
    expect(returnedCount(library(session))).toBe(3)

    session.sorter.click()
    runSorter(session.sorter, 400)
    session.store.apply((game) => deleteBook(game, readingIds[0])) // 정리 대기 맨 앞 도서 회수
    runSorter(session.sorter, 2 * SORT_MS + 200)

    expect(returnedCount(library(session))).toBe(0)
    expect(availableBookIds(library(session))).toHaveLength(2)
    expect(session.sorter.isActive()).toBe(false)
  })
})
