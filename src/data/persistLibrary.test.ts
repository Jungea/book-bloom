import { describe, expect, it, vi } from 'vitest'
import { createLibraryStore } from '../core/libraryStore'
import { restoreLibrary, type LibrarySnapshot } from '../core/librarySnapshot'
import type { LibraryStorage } from './libraryStorage'
import { attachPersistence } from './persistLibrary'

const book = (n: number) => ({ id: `b${n}`, title: `도서 ${n}` })

/** 저장을 수동으로 끝낼 수 있는 가짜 저장소. */
function fakeStorage(options: { failTimes?: number; manual?: boolean } = {}) {
  const saved: LibrarySnapshot[] = []
  const releases: (() => void)[] = []
  let failures = options.failTimes ?? 0
  let inFlight = 0
  let maxInFlight = 0

  const storage: LibraryStorage = {
    load: async () => saved.at(-1) ?? null,
    clear: async () => {
      saved.length = 0
    },
    quarantine: async () => {},
    save: async (snapshot) => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      if (options.manual) await new Promise<void>((resolve) => releases.push(resolve))
      inFlight -= 1
      if (failures > 0) {
        failures -= 1
        throw new Error('저장 실패')
      }
      saved.push(snapshot)
    },
  }
  return { storage, saved, releases, maxInFlight: () => maxInFlight }
}

describe('attachPersistence', () => {
  it('상태가 바뀔 때마다 저장한다', async () => {
    const store = createLibraryStore(3)
    const { storage, saved } = fakeStorage()
    const persistence = attachPersistence(store, storage, vi.fn())

    store.acquire(book(1))
    await persistence.flush()
    store.acquire(book(2))
    await persistence.flush()

    expect(saved).toHaveLength(2)
    expect(saved.at(-1)?.shelf.map((b) => b?.id ?? null)).toEqual(['b1', 'b2', null])
  })

  it('변화가 없으면 저장하지 않는다', async () => {
    const store = createLibraryStore(3)
    store.acquire(book(1))
    const { storage, saved } = fakeStorage()
    const persistence = attachPersistence(store, storage, vi.fn())

    store.acquire(book(1)) // 중복이라 상태가 같다
    await persistence.flush()

    expect(saved).toHaveLength(0)
  })

  it('저장 중에 여러 번 바뀌면 한 번에 하나씩 저장하고 마지막 상태가 남는다', async () => {
    const store = createLibraryStore(5)
    const fake = fakeStorage({ manual: true })
    const persistence = attachPersistence(store, fake.storage, vi.fn())

    store.acquire(book(1))
    store.acquire(book(2))
    store.acquire(book(3))
    const done = persistence.flush()
    while (fake.releases.length === 0) await Promise.resolve()
    fake.releases.shift()?.()
    while (fake.releases.length === 0) await Promise.resolve()
    fake.releases.shift()?.()
    await done

    expect(fake.maxInFlight()).toBe(1)
    expect(fake.saved.at(-1)?.shelf.map((b) => b?.id ?? null)).toEqual(['b1', 'b2', 'b3', null, null])
  })

  it('저장이 실패하면 알리고 다음 변경 때 다시 저장한다', async () => {
    const store = createLibraryStore(3)
    const { storage, saved } = fakeStorage({ failTimes: 1 })
    const onError = vi.fn()
    const persistence = attachPersistence(store, storage, onError)

    store.acquire(book(1))
    await persistence.flush()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(saved).toHaveLength(0)

    store.acquire(book(2))
    await persistence.flush()
    expect(saved).toHaveLength(1)
    expect(saved[0].shelf.map((b) => b?.id ?? null)).toEqual(['b1', 'b2', null])
  })

  it('저장에 성공할 때마다 onSaved를 부른다', async () => {
    const store = createLibraryStore(3)
    const { storage } = fakeStorage({ failTimes: 1 })
    const onSaved = vi.fn()
    const persistence = attachPersistence(store, storage, vi.fn(), onSaved)

    store.acquire(book(1)) // 실패
    await persistence.flush()
    expect(onSaved).not.toHaveBeenCalled()

    store.acquire(book(2)) // 성공
    await persistence.flush()
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('detach 후에는 저장하지 않는다', async () => {
    const store = createLibraryStore(3)
    const { storage, saved } = fakeStorage()
    const persistence = attachPersistence(store, storage, vi.fn())

    persistence.detach()
    store.acquire(book(1))
    await persistence.flush()

    expect(saved).toHaveLength(0)
  })

  it('저장한 값을 다시 불러오면 같은 상태로 복원된다', async () => {
    const store = createLibraryStore(2)
    const { storage } = fakeStorage()
    const persistence = attachPersistence(store, storage, vi.fn())

    store.acquireMany([book(1), book(2), book(3)])
    await persistence.flush()

    const result = restoreLibrary(await storage.load(), 2)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.state).toEqual(store.getState())
  })

  it('초기화도 빈 상태로 저장한다', async () => {
    const store = createLibraryStore(2)
    const { storage, saved } = fakeStorage()
    const persistence = attachPersistence(store, storage, vi.fn())

    store.acquire(book(1))
    await persistence.flush()
    store.reset()
    await persistence.flush()

    expect(saved.at(-1)?.shelf).toEqual([null, null])
    expect(saved.at(-1)?.storage).toEqual([])
  })
})
