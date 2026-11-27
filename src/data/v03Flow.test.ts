import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activeLoan,
  bookStatus,
  reserveBook,
  returnedCount,
  settleDueLoans,
  startLoan,
} from '../core/circulation'
import { acquireBooks, createLibrary, type LibraryState } from '../core/library'
import { toSnapshot } from '../core/librarySnapshot'
import { restoreGame, toGameSnapshot, type GameSnapshot } from '../reading/gameSnapshot'
import { createGameStore, type GameStore } from '../reading/gameStore'
import {
  createGame,
  deleteBook,
  finishReading,
  registerBook,
  startReading,
  type Game,
} from '../reading/reading'
import type { GameStorage } from './gameStorage'
import { loadGame } from './loadGame'
import { attachPersistence } from './persistGame'

const HOUR = 3_600_000
const CAPACITY = 4

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
  return { storage, peek: () => stored }
}

/** 앱 한 번 실행. nowMs가 그 실행의 현재 시각이다. */
async function launch(storage: GameStorage, nowMs: number) {
  const loaded = await loadGame(storage, CAPACITY, nowMs)
  if (!loaded.ok) throw new Error(loaded.message)
  const store = createGameStore(CAPACITY, loaded.game)
  const persistence = attachPersistence(store, storage, (error) => {
    throw error
  })
  return { store, persistence, notice: loaded.notice }
}

function registerAndStart(store: GameStore, title: string): string {
  const registered = store.apply((game) => registerBook(game, { title, genre: '문학' }))
  if (!registered.ok) throw new Error(registered.reason)
  const started = store.apply((game) => startReading(game, registered.bookId))
  if (!started.ok) throw new Error(started.reason)
  return registered.bookId
}

/** 게임 도서 한 권을 예약·대출까지 진행하는 동작(손님 연동은 2단계). */
function lend(store: GameStore, libraryBookId: string, nowMs: number, durationMs = HOUR): string {
  const reserved = reserveBook(store.getState().library, libraryBookId, nowMs)
  if (!reserved.ok) throw new Error(reserved.reason)
  const loaned = startLoan(reserved.state, reserved.loanId, nowMs, durationMs)
  if (!loaned.ok) throw new Error(loaned.reason)
  store.apply((game) => ({ ok: true, game: { ...game, library: loaned.state } }))
  return reserved.loanId
}

function reserveOnly(store: GameStore, libraryBookId: string, nowMs: number): string {
  const reserved = reserveBook(store.getState().library, libraryBookId, nowMs)
  if (!reserved.ok) throw new Error(reserved.reason)
  store.apply((game) => ({ ok: true, game: { ...game, library: reserved.state } }))
  return reserved.loanId
}

const library = (store: GameStore) => store.getState().library

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('v0.3 저장·복원: 재실행 사이의 대출 상태', () => {
  it('대출 중인 도서는 만기 전에 재실행하면 대출 중으로 복원된다', async () => {
    const disk = memoryDisk()
    const first = await launch(disk.storage, 1_000)
    registerAndStart(first.store, '데미안')
    lend(first.store, 'lib:start:book-1', 2_000)
    await first.persistence.flush()

    const second = await launch(disk.storage, 2_000 + HOUR - 1)
    expect(bookStatus(library(second.store), 'lib:start:book-1')).toBe('ON_LOAN')
    expect(activeLoan(library(second.store), 'lib:start:book-1')?.dueAt).toBe(2_000 + HOUR)
  })

  it('앱이 꺼져 있는 동안 만기가 지나면 재실행 때 반납 트레이로 옮겨진다', async () => {
    const disk = memoryDisk()
    const first = await launch(disk.storage, 1_000)
    registerAndStart(first.store, '데미안')
    lend(first.store, 'lib:start:book-1', 2_000)
    await first.persistence.flush()

    const second = await launch(disk.storage, 2_000 + 5 * HOUR)
    expect(bookStatus(library(second.store), 'lib:start:book-1')).toBe('RETURNED')
    expect(returnedCount(library(second.store))).toBe(1)
    // 정리 전까지 원래 슬롯을 지키고 있어 같은 자리에 책이 있다.
    expect(library(second.store).shelf[0]?.id).toBe('lib:start:book-1')
  })

  it('만기 후 재실행한 상태를 다시 저장·재실행해도 같다', async () => {
    const disk = memoryDisk()
    const first = await launch(disk.storage, 1_000)
    registerAndStart(first.store, '데미안')
    lend(first.store, 'lib:start:book-1', 2_000)
    await first.persistence.flush()

    const second = await launch(disk.storage, 2_000 + 5 * HOUR)
    second.store.apply((game) => registerBook(game, { title: '변신', genre: '문학' })) // 저장을 일으키는 변경
    await second.persistence.flush()

    const third = await launch(disk.storage, 2_000 + 6 * HOUR)
    expect(bookStatus(library(third.store), 'lib:start:book-1')).toBe('RETURNED')
    expect(returnedCount(library(third.store))).toBe(1)
  })

  it('예약 중에 앱이 종료되면 재실행 때 예약이 해제되어 다시 대출할 수 있다', async () => {
    const disk = memoryDisk()
    const first = await launch(disk.storage, 1_000)
    registerAndStart(first.store, '데미안')
    reserveOnly(first.store, 'lib:start:book-1', 2_000)
    await first.persistence.flush()
    // 저장된 데이터에는 예약이 들어 있다.
    expect((disk.peek() as GameSnapshot).library.circulation.loans[0].status).toBe('RESERVED')

    const second = await launch(disk.storage, 3_000)
    expect(bookStatus(library(second.store), 'lib:start:book-1')).toBe('AVAILABLE')
    expect(library(second.store).circulation.loans).toEqual([])
    expect(reserveBook(library(second.store), 'lib:start:book-1', 3_100).ok).toBe(true)
  })
})

describe('v0.3 대출 중 독서 보상 회수', () => {
  it('대출 중인 도서의 독서 기록을 지워도 대출은 유지되고 반납 시점에 제거된다', async () => {
    const disk = memoryDisk()
    const first = await launch(disk.storage, 1_000)
    const bookId = registerAndStart(first.store, '데미안')
    lend(first.store, 'lib:start:book-1', 2_000)

    first.store.apply((game) => deleteBook(game, bookId)) // 독서 보상 회수
    expect(bookStatus(library(first.store), 'lib:start:book-1')).toBe('ON_LOAN')
    await first.persistence.flush()

    // 만기 전 재실행: 아직 대출 중이고 회수 표시가 남아 있다.
    const midway = await launch(disk.storage, 2_000 + HOUR - 1)
    expect(activeLoan(library(midway.store), 'lib:start:book-1')?.revokeOnReturn).toBe(true)

    // 만기 후 재실행: 제거되고 반납 트레이에는 들어가지 않는다.
    const after = await launch(disk.storage, 2_000 + 2 * HOUR)
    expect(bookStatus(library(after.store), 'lib:start:book-1')).toBeNull()
    expect(returnedCount(library(after.store))).toBe(0)
    expect(library(after.store).shelf.every((entry) => entry === null)).toBe(true)
  })

  it('대출 중이 아닌 도서는 독서 기록을 지우면 즉시 제거된다', async () => {
    const disk = memoryDisk()
    const { store } = await launch(disk.storage, 1_000)
    const bookId = registerAndStart(store, '데미안')
    store.apply((game) => deleteBook(game, bookId))
    expect(bookStatus(library(store), 'lib:start:book-1')).toBeNull()
  })

  it('완독 보상도 같은 규칙이다: 대출 중인 완독 도서는 완독 취소 시 반납 때 제거된다', async () => {
    const { storage } = memoryDisk()
    const { store } = await launch(storage, 1_000)
    const bookId = registerAndStart(store, '데미안')
    store.apply((game) => finishReading(game, bookId)) // 완독 보상 1권 더
    lend(store, 'lib:finish:session-2', 2_000)
    expect(bookStatus(library(store), 'lib:finish:session-2')).toBe('ON_LOAN')
  })
})

describe('v3 저장 형식과 마이그레이션', () => {
  /** 예약·대출·반납 대기·정리 완료가 모두 있는 도서관. */
  function busyLibrary(): LibraryState {
    let state = acquireBooks(
      createLibrary(CAPACITY),
      [1, 2, 3, 4].map((n) => ({ id: `b${n}`, title: `도서 ${n}` })),
    )
    const lendOne = (id: string, now: number, duration = HOUR) => {
      const reserved = reserveBook(state, id, now)
      if (!reserved.ok) throw new Error(reserved.reason)
      const loaned = startLoan(reserved.state, reserved.loanId, now, duration)
      if (!loaned.ok) throw new Error(loaned.reason)
      state = loaned.state
    }
    lendOne('b1', 0, HOUR) // 반납 대기가 될 도서
    lendOne('b2', 0, 10 * HOUR) // 대출 중으로 남을 도서
    state = settleDueLoans(state, 2 * HOUR)
    const reserved = reserveBook(state, 'b3', 3 * HOUR) // 예약 중
    if (!reserved.ok) throw new Error(reserved.reason)
    return reserved.state
  }

  const roundTrip = (value: unknown): any => JSON.parse(JSON.stringify(value))

  it('예약·대출·반납 대기가 섞인 상태가 그대로 복원된다', () => {
    const game: Game = { ...createGame(busyLibrary()) }
    const result = restoreGame(roundTrip(toGameSnapshot(game)), CAPACITY)
    expect(result).toEqual({ ok: true, game })
    if (result.ok) {
      expect(bookStatus(result.game.library, 'b1')).toBe('RETURNED')
      expect(bookStatus(result.game.library, 'b2')).toBe('ON_LOAN')
      expect(bookStatus(result.game.library, 'b3')).toBe('RESERVED')
      expect(bookStatus(result.game.library, 'b4')).toBe('AVAILABLE')
    }
  })

  it('v2(대출 기록 없음)는 빈 대출 기록으로 복원되고 도서·독서 기록은 그대로다', () => {
    const game = createGame(acquireBooks(createLibrary(CAPACITY), [{ id: 'b1', title: '도서 1' }]))
    const v3 = toGameSnapshot(game)
    const { circulation: _removed, ...libraryV2 } = v3.library
    const v2 = roundTrip({ ...v3, version: 2, library: libraryV2 })

    const result = restoreGame(v2, CAPACITY)
    expect(result).toEqual({ ok: true, game })
  })

  it('v1(도서관만 저장)도 빈 대출 기록과 빈 독서 기록으로 복원된다', () => {
    const library = acquireBooks(createLibrary(CAPACITY), [{ id: 'b1', title: '도서 1' }])
    const result = restoreGame(roundTrip(toSnapshot(library)), CAPACITY)
    expect(result).toEqual({ ok: true, game: createGame(library) })
  })

  it('v2를 불러와 저장하면 v3로 저장된다', async () => {
    const disk = memoryDisk()
    const library = acquireBooks(createLibrary(CAPACITY), [{ id: 'b1', title: '도서 1' }])
    const v3 = toGameSnapshot(createGame(library))
    const { circulation: _removed, ...libraryV2 } = v3.library
    await disk.storage.save({ ...v3, version: 2, library: libraryV2 } as unknown as GameSnapshot)

    const { store, persistence } = await launch(disk.storage, 1_000)
    store.acquire({ id: 'b2', title: '도서 2' })
    await persistence.flush()
    expect((disk.peek() as GameSnapshot).version).toBe(3)
    expect((disk.peek() as GameSnapshot).library.circulation).toEqual({ loans: [], returnQueue: [], nextSeq: 1 })
  })

  const corrupt = (change: (snapshot: any) => void) => {
    const snapshot = roundTrip(toGameSnapshot(createGame(busyLibrary())))
    change(snapshot)
    return restoreGame(snapshot, CAPACITY)
  }

  it.each<[string, (snapshot: any) => void]>([
    ['대출 기록이 없는 도서를 가리킴', (s) => { s.library.circulation.loans[0].bookId = 'nope' }],
    ['같은 도서에 진행 중인 기록 2개', (s) => { s.library.circulation.loans[1].bookId = 'b1' }],
    ['반납 대기열이 기록과 어긋남', (s) => { s.library.circulation.returnQueue = [] }],
    ['반납 대기열에 중복', (s) => { s.library.circulation.returnQueue.push(s.library.circulation.returnQueue[0]) }],
    ['다음 번호가 기존 기록보다 작음', (s) => { s.library.circulation.nextSeq = 1 }],
    ['알 수 없는 상태', (s) => { s.library.circulation.loans[0].status = 'LOST' }],
    ['시각이 숫자가 아님', (s) => { s.library.circulation.loans[0].dueAt = 'x' }],
    ['대출 중인데 반납 예정 시각이 없음', (s) => { s.library.circulation.loans[1].dueAt = null }],
    ['반납 대기인데 반납 시각이 없음', (s) => { s.library.circulation.loans[0].returnedAt = null }],
    ['예약인데 대출 시각이 있음', (s) => { s.library.circulation.loans[2].loanedAt = 1 }],
    ['대출 기록이 배열이 아님', (s) => { s.library.circulation.loans = 'x' }],
    ['대출 기록이 없음', (s) => { delete s.library.circulation }],
  ])('깨진 v3 데이터는 복원하지 않는다: %s', (_name, change) => {
    expect(corrupt(change).ok).toBe(false)
  })

  it('책장 용량이 줄어 보관함으로 밀려난 도서의 진행 중 기록은 버리고 나머지는 유지한다', () => {
    const snapshot = roundTrip(toGameSnapshot(createGame(busyLibrary()))) // b1 반납 대기, b2 대출 중, b3 예약
    const result = restoreGame(snapshot, 2) // 슬롯 b1·b2만 남고 b3·b4는 보관함
    if (!result.ok) throw new Error(result.reason)
    expect(bookStatus(result.game.library, 'b1')).toBe('RETURNED')
    expect(bookStatus(result.game.library, 'b2')).toBe('ON_LOAN')
    expect(bookStatus(result.game.library, 'b3')).toBe('STORED')
    expect(result.game.library.circulation.loans.some((loan) => loan.bookId === 'b3')).toBe(false)
  })
})
