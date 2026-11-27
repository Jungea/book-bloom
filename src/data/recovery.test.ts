import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bookStatus, reserveBook, returnedCount, startLoan } from '../core/circulation'
import { acquireBooks, createLibrary } from '../core/library'
import { toGameSnapshot, type GameSnapshot } from '../reading/gameSnapshot'
import { createGameStore } from '../reading/gameStore'
import { createGame, type Game } from '../reading/reading'
import type { GameStorage } from './gameStorage'
import { loadGame } from './loadGame'
import { attachPersistence } from './persistGame'

const HOUR = 3_600_000

function memoryDisk(initial: GameSnapshot | null = null) {
  let stored: unknown = initial === null ? null : structuredClone(initial)
  let saves = 0
  const storage: GameStorage = {
    load: async () => (stored === null ? null : structuredClone(stored)),
    save: async (snapshot: GameSnapshot) => {
      saves += 1
      stored = structuredClone(snapshot)
    },
    clear: async () => {
      stored = null
    },
    quarantine: async () => {},
  }
  return { storage, peek: () => stored as GameSnapshot | null, saves: () => saves }
}

/** 책 3권, b1을 예약만 한 게임과 b1을 대출 중(반납 예정 = due)으로 만든 게임. */
function libraryGame(stage: 'reserved' | 'on-loan', dueAt = HOUR): Game {
  let library = acquireBooks(
    createLibrary(4),
    [1, 2, 3].map((n) => ({ id: `b${n}`, title: `도서 ${n}` })),
  )
  const reserved = reserveBook(library, 'b1', 0)
  if (!reserved.ok) throw new Error(reserved.reason)
  library = reserved.state
  if (stage === 'on-loan') {
    const loaned = startLoan(library, reserved.loanId, 0, dueAt)
    if (!loaned.ok) throw new Error(loaned.reason)
    library = loaned.state
  }
  return createGame(library)
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('loadGame의 recovered', () => {
  it('저장된 데이터가 없으면 false다', async () => {
    const loaded = await loadGame(memoryDisk().storage, 4, 0)
    expect(loaded.ok && loaded.recovered).toBe(false)
  })

  it('복구할 것이 없으면(만기 전 대출 중) false이고 상태가 그대로다', async () => {
    const disk = memoryDisk(toGameSnapshot(libraryGame('on-loan', HOUR)))
    const loaded = await loadGame(disk.storage, 4, HOUR - 1)
    if (!loaded.ok) throw new Error(loaded.message)
    expect(loaded.recovered).toBe(false)
    expect(bookStatus(loaded.game.library, 'b1')).toBe('ON_LOAN')
  })

  it('만기가 지난 대출을 반납 트레이로 옮겼으면 true다', async () => {
    const disk = memoryDisk(toGameSnapshot(libraryGame('on-loan', HOUR)))
    const loaded = await loadGame(disk.storage, 4, 3 * HOUR)
    if (!loaded.ok) throw new Error(loaded.message)
    expect(loaded.recovered).toBe(true)
    expect(bookStatus(loaded.game.library, 'b1')).toBe('RETURNED')
  })

  it('예약 중이던 기록을 해제했으면 true다(만기와 무관)', async () => {
    const disk = memoryDisk(toGameSnapshot(libraryGame('reserved')))
    const loaded = await loadGame(disk.storage, 4, 1_000)
    if (!loaded.ok) throw new Error(loaded.message)
    expect(loaded.recovered).toBe(true)
    expect(bookStatus(loaded.game.library, 'b1')).toBe('AVAILABLE')
  })
})

describe('부팅 직후 복구 결과 저장(Shell의 동작)', () => {
  /** App의 Shell이 하는 일: 복원 → 저장 연결 → 복구가 있었으면 saveNow. */
  async function boot(disk: ReturnType<typeof memoryDisk>, nowMs: number) {
    const loaded = await loadGame(disk.storage, 4, nowMs)
    if (!loaded.ok) throw new Error(loaded.message)
    const store = createGameStore(4, loaded.game)
    const persistence = attachPersistence(store, disk.storage, (error) => {
      throw error
    })
    if (loaded.recovered) void persistence.saveNow()
    await persistence.flush()
    return { store, loaded }
  }

  it('만기 후 재실행하면 첫 변경 전에 저장소가 반납 대기 상태로 갱신된다', async () => {
    const disk = memoryDisk(toGameSnapshot(libraryGame('on-loan', HOUR)))
    expect(disk.peek()?.library.circulation.loans[0].status).toBe('ON_LOAN') // 복구 전 저장소

    await boot(disk, 3 * HOUR)
    expect(disk.saves()).toBe(1)
    expect(disk.peek()?.library.circulation.loans[0].status).toBe('RETURNED')
    expect(disk.peek()?.library.circulation.returnQueue).toHaveLength(1)
  })

  it('예약 중에 종료된 저장소는 재실행 직후 예약이 지워진 상태로 갱신된다', async () => {
    const disk = memoryDisk(toGameSnapshot(libraryGame('reserved')))
    await boot(disk, 1_000)
    expect(disk.peek()?.library.circulation.loans).toEqual([])
  })

  it('복구할 것이 없으면 변경 전에는 저장하지 않는다', async () => {
    const disk = memoryDisk(toGameSnapshot(libraryGame('on-loan', HOUR)))
    await boot(disk, HOUR - 1)
    expect(disk.saves()).toBe(0)
  })

  it('복구 결과를 저장한 뒤 다시 재실행해도 같은 상태이고 더 저장하지 않는다', async () => {
    const disk = memoryDisk(toGameSnapshot(libraryGame('on-loan', HOUR)))
    await boot(disk, 3 * HOUR)
    const second = await boot(disk, 4 * HOUR)
    expect(second.loaded.recovered).toBe(false)
    expect(returnedCount(second.store.getState().library)).toBe(1)
    expect(disk.saves()).toBe(1)
  })
})
