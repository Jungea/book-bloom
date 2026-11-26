import { describe, expect, it, vi } from 'vitest'
import { createLibraryStore } from './libraryStore'

const book = (n: number) => ({ id: `b${n}`, title: `도서 ${n}` })

describe('createLibraryStore', () => {
  it('획득하면 구독자에게 알린다', () => {
    const store = createLibraryStore(2)
    const listener = vi.fn()
    store.subscribe(listener)
    store.acquire(book(1))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getState().shelf[0]?.id).toBe('b1')
  })

  it('중복 획득은 알리지 않는다', () => {
    const store = createLibraryStore(2)
    store.acquire(book(1))
    const listener = vi.fn()
    store.subscribe(listener)
    store.acquire(book(1))
    expect(listener).not.toHaveBeenCalled()
  })

  it('여러 권을 한 번에 획득하면 한 번만 알린다', () => {
    const store = createLibraryStore(2)
    const listener = vi.fn()
    store.subscribe(listener)
    store.acquireMany([book(1), book(2), book(3)])
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getState().storage).toHaveLength(1)
  })

  it('초기화하면 같은 용량의 빈 도서관으로 돌아간다', () => {
    const store = createLibraryStore(2)
    store.acquireMany([book(1), book(2), book(3)])
    store.reset()
    expect(store.getState().shelf).toEqual([null, null])
    expect(store.getState().storage).toEqual([])
  })

  it('구독을 해제하면 더 이상 알리지 않는다', () => {
    const store = createLibraryStore(1)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.acquire(book(1))
    expect(listener).not.toHaveBeenCalled()
  })
})
