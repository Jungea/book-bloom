import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acquireBooks, createLibrary } from '../core/library'
import { toGameSnapshot } from '../reading/gameSnapshot'
import { createGame, registerBook, startReading } from '../reading/reading'
import { toSnapshot } from '../core/librarySnapshot'
import type { GameStorage } from './gameStorage'
import { loadGame } from './loadGame'

const book = (n: number) => ({ id: `b${n}`, title: `도서 ${n}` })

function storageWith(options: {
  stored?: unknown
  loadError?: Error
  quarantineError?: Error
}) {
  const quarantined: unknown[] = []
  const storage: GameStorage = {
    load: async () => {
      if (options.loadError) throw options.loadError
      return options.stored ?? null
    },
    save: async () => {},
    clear: async () => {},
    quarantine: async (raw) => {
      if (options.quarantineError) throw options.quarantineError
      quarantined.push(raw)
    },
  }
  return { storage, quarantined }
}

describe('loadGame', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('저장된 데이터가 없으면 안내 없이 빈 도서관으로 시작한다', async () => {
    const { storage } = storageWith({})
    const { game, notice } = await loadGame(storage, 3)
    expect(game).toEqual(createGame(createLibrary(3)))
    expect(notice).toBeNull()
  })

  it('이전 형식(v1, 도서관만 저장)은 독서 기록이 빈 상태로 복원한다', async () => {
    const saved = acquireBooks(createLibrary(3), [book(1), book(2)])
    const { storage } = storageWith({ stored: JSON.parse(JSON.stringify(toSnapshot(saved))) })
    const { game, notice } = await loadGame(storage, 3)
    expect(game).toEqual(createGame(saved))
    expect(notice).toBeNull()
  })

  it('저장된 독서 기록과 도서관을 함께 복원한다', async () => {
    let saved = createGame(createLibrary(3))
    const registered = registerBook(saved, { title: '데미안', genre: '문학' })
    if (!registered.ok) throw new Error(registered.reason)
    const started = startReading(registered.game, registered.bookId)
    if (!started.ok) throw new Error(started.reason)
    saved = started.game

    const { storage } = storageWith({ stored: JSON.parse(JSON.stringify(toGameSnapshot(saved))) })
    const { game, notice } = await loadGame(storage, 3)
    expect(game).toEqual(saved)
    expect(game.library.shelf.filter(Boolean)).toHaveLength(1)
    expect(notice).toBeNull()
  })

  it('불러오기가 실패하면 빈 도서관으로 시작하고 알린다', async () => {
    const { storage } = storageWith({ loadError: new Error('열 수 없음') })
    const { game, notice } = await loadGame(storage, 3)
    expect(game).toEqual(createGame(createLibrary(3)))
    expect(notice).toContain('불러오지 못했습니다')
  })

  it('깨진 데이터는 빈 도서관으로 시작하되 원본을 따로 보관한다', async () => {
    const broken = { version: 99 }
    const { storage, quarantined } = storageWith({ stored: broken })
    const { game, notice } = await loadGame(storage, 3)
    expect(game).toEqual(createGame(createLibrary(3)))
    expect(quarantined).toEqual([broken])
    expect(notice).toContain('원본은 따로 보관했습니다')
  })

  it('원본 보관에도 실패하면 그 사실을 알린다', async () => {
    const { storage } = storageWith({ stored: { version: 99 }, quarantineError: new Error('가득 참') })
    const { game, notice } = await loadGame(storage, 3)
    expect(game).toEqual(createGame(createLibrary(3)))
    expect(notice).toContain('보관하지 못했습니다')
  })
})
