import { describe, expect, it, vi } from 'vitest'
import { createGameStore } from '../reading/gameStore'
import type { GameSnapshot } from '../reading/gameSnapshot'
import type { GameStorage } from './gameStorage'
import { attachPersistence } from './persistGame'

const book = (n: number) => ({ id: `b${n}`, title: `도서 ${n}` })

/** 저장을 수동으로 끝낼 수 있는 가짜 저장소. */
function fakeStorage(manual = false) {
  const saved: GameSnapshot[] = []
  const releases: (() => void)[] = []
  let inFlight = 0
  let maxInFlight = 0
  const storage: GameStorage = {
    load: async () => null,
    clear: async () => {},
    quarantine: async () => {},
    save: async (snapshot) => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      if (manual) await new Promise<void>((resolve) => releases.push(resolve))
      inFlight -= 1
      saved.push(snapshot)
    },
  }
  return { storage, saved, releases, maxInFlight: () => maxInFlight }
}

describe('Persistence.saveNow', () => {
  it('변경이 없어도 현재 상태를 한 번 저장한다', async () => {
    const store = createGameStore(3)
    store.acquire(book(1))
    const { storage, saved } = fakeStorage()
    const persistence = attachPersistence(store, storage, vi.fn())

    await persistence.saveNow()
    expect(saved).toHaveLength(1)
    expect(saved[0].library.shelf.map((b) => b?.id ?? null)).toEqual(['b1', null, null])
  })

  it('저장 중에 불러도 동시에 쓰지 않고 순서대로 마지막 상태까지 저장한다', async () => {
    const store = createGameStore(5)
    const fake = fakeStorage(true)
    const persistence = attachPersistence(store, fake.storage, vi.fn())

    store.acquire(book(1)) // 저장 시작(대기 중)
    void persistence.saveNow() // 이미 저장 중이라 최신 상태만 이어서 저장하도록 맡긴다
    store.acquire(book(2))
    const done = persistence.flush()

    while (fake.releases.length === 0) await Promise.resolve()
    fake.releases.shift()?.()
    while (fake.releases.length === 0) await Promise.resolve()
    fake.releases.shift()?.()
    await done

    expect(fake.maxInFlight()).toBe(1)
    expect(fake.saved.at(-1)?.library.shelf.map((b) => b?.id ?? null)).toEqual(['b1', 'b2', null, null, null])
  })

  it('저장이 실패하면 오류를 알리고 다음 변경 때 다시 시도한다', async () => {
    const store = createGameStore(3)
    const onError = vi.fn()
    let failures = 1
    const saved: GameSnapshot[] = []
    const storage: GameStorage = {
      load: async () => null,
      clear: async () => {},
      quarantine: async () => {},
      save: async (snapshot) => {
        if (failures > 0) {
          failures -= 1
          throw new Error('저장 실패')
        }
        saved.push(snapshot)
      },
    }
    const persistence = attachPersistence(store, storage, onError)

    await persistence.saveNow()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(saved).toHaveLength(0)

    store.acquire(book(1))
    await persistence.flush()
    expect(saved).toHaveLength(1)
  })

  it('연결을 끊은 뒤에는 변경을 저장하지 않는다', async () => {
    const store = createGameStore(3)
    const { storage, saved } = fakeStorage()
    const persistence = attachPersistence(store, storage, vi.fn())
    persistence.detach()
    store.acquire(book(1))
    await persistence.flush()
    expect(saved).toHaveLength(0)
  })
})
