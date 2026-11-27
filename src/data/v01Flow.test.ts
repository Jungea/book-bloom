import { describe, expect, it, vi } from 'vitest'
import { shelvedCount, storedCount } from '../core/library'
import type { GameSnapshot } from '../reading/gameSnapshot'
import { createGameStore, type GameStore } from '../reading/gameStore'
import {
  cancelFinish,
  deleteBook,
  dropReading,
  finishReading,
  registerBook,
  startReading,
} from '../reading/reading'
import type { GameStorage } from './gameStorage'
import { loadGame } from './loadGame'
import { attachPersistence } from './persistGame'

const CAPACITY = 3

/** IndexedDB처럼 값을 복제해 보관하는 메모리 저장소. 앱 종료 후에도 남는 디스크를 흉내 낸다. */
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
  return storage
}

/** 앱 한 번 실행: 저장된 데이터를 불러와 저장소를 만들고 저장을 연결한다. */
async function launch(storage: GameStorage) {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const loaded = await loadGame(storage, CAPACITY)
  if (!loaded.ok) throw new Error(loaded.message)
  const store = createGameStore(CAPACITY, loaded.game)
  const persistence = attachPersistence(store, storage, (error) => {
    throw error
  })
  return { store, persistence, notice: loaded.notice }
}

function register(store: GameStore, title: string): string {
  const result = store.apply((game) => registerBook(game, { title, genre: '문학' }))
  if (!result.ok) throw new Error(result.reason)
  return result.bookId
}

function act(store: GameStore, action: Parameters<typeof store.apply>[0]) {
  const result = store.apply(action)
  if (!result.ok) throw new Error(result.reason)
}

const library = (store: GameStore) => store.getState().library
const shelfTitles = (store: GameStore) =>
  library(store).shelf.filter((book) => book !== null).map((book) => book.title)

describe('v0.1 통합 시나리오: 독서 기록 → 도서 획득 → 저장 → 재실행', () => {
  it('독서 시작 +1권, 첫 완독 +1권이 책장에 쌓이고 재실행 후에도 같다', async () => {
    const disk = memoryDisk()
    const first = await launch(disk)

    const bookId = register(first.store, '데미안')
    expect(shelvedCount(library(first.store))).toBe(0) // 등록만으로는 얻지 않는다
    act(first.store, (game) => startReading(game, bookId))
    expect(shelvedCount(library(first.store))).toBe(1)
    act(first.store, (game) => finishReading(game, bookId))
    expect(shelfTitles(first.store)).toEqual(['데미안', '데미안'])
    await first.persistence.flush()

    const second = await launch(disk)
    expect(second.notice).toBeNull()
    expect(second.store.getState()).toEqual(first.store.getState())
    expect(shelfTitles(second.store)).toEqual(['데미안', '데미안'])
  })

  it('중복 보상이 없다: 하차·재개·완독 취소 후 다시 완독해도 권수가 늘지 않는다', async () => {
    const disk = memoryDisk()
    const { store, persistence } = await launch(disk)
    const bookId = register(store, '변신')

    act(store, (game) => startReading(game, bookId))
    act(store, (game) => dropReading(game, bookId))
    act(store, (game) => startReading(game, bookId)) // 재개: 추가 지급 없음
    expect(shelvedCount(library(store))).toBe(1)

    act(store, (game) => finishReading(game, bookId))
    expect(shelvedCount(library(store))).toBe(2)
    act(store, (game) => cancelFinish(game, bookId)) // 완독 보상 회수
    expect(shelvedCount(library(store))).toBe(1)
    act(store, (game) => finishReading(game, bookId)) // 다시 완독
    expect(shelvedCount(library(store))).toBe(2)

    await persistence.flush()
    const again = await launch(disk)
    expect(shelvedCount(library(again.store))).toBe(2)
  })

  it('책장이 가득 차면 초과 도서가 보관함으로 가고, 재실행 후에도 보관함이 유지된다', async () => {
    const disk = memoryDisk()
    const first = await launch(disk)

    // 도서 2권 × (시작 + 완독) = 4권. 책장 용량은 3권이다.
    for (const title of ['가', '나']) {
      const id = register(first.store, title)
      act(first.store, (game) => startReading(game, id))
      act(first.store, (game) => finishReading(game, id))
    }
    expect(shelvedCount(library(first.store))).toBe(CAPACITY)
    expect(storedCount(library(first.store))).toBe(1)
    await first.persistence.flush()

    const second = await launch(disk)
    expect(shelvedCount(library(second.store))).toBe(CAPACITY)
    expect(storedCount(library(second.store))).toBe(1)
    expect(library(second.store).storage.map((book) => book.title)).toEqual(['나'])
  })

  it('보관함 도서는 책장에 빈 슬롯이 생기면 획득 순서대로 올라온다', async () => {
    const disk = memoryDisk()
    const { store, persistence } = await launch(disk)
    const ids = ['가', '나'].map((title) => {
      const id = register(store, title)
      act(store, (game) => startReading(game, id))
      act(store, (game) => finishReading(game, id))
      return id
    })
    expect(storedCount(library(store))).toBe(1)

    act(store, (game) => deleteBook(game, ids[0])) // '가' 2권 회수 → 빈 슬롯 2개
    expect(storedCount(library(store))).toBe(0)
    expect(shelfTitles(store)).toEqual(['나', '나'])

    await persistence.flush()
    const again = await launch(disk)
    expect(storedCount(library(again.store))).toBe(0)
    expect(shelfTitles(again.store)).toEqual(['나', '나'])
  })

  it('개발자 초기화 뒤 재실행하면 빈 도서관이다', async () => {
    const disk = memoryDisk()
    const first = await launch(disk)
    const id = register(first.store, '도서')
    act(first.store, (game) => startReading(game, id))
    first.store.reset()
    await first.persistence.flush()

    const second = await launch(disk)
    expect(shelvedCount(library(second.store))).toBe(0)
    expect(second.store.getState().reading.books).toEqual([])
  })
})
