import { describe, expect, it, vi } from 'vitest'
import { createGameStore } from './gameStore'
import { finishReading, registerBook, startReading } from './reading'

const book = (n: number) => ({ id: `b${n}`, title: `도서 ${n}` })

describe('createGameStore', () => {
  it('획득하면 구독자에게 알린다', () => {
    const store = createGameStore(2)
    const listener = vi.fn()
    store.subscribe(listener)
    store.acquire(book(1))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getState().library.shelf[0]?.id).toBe('b1')
  })

  it('중복 획득은 알리지 않는다', () => {
    const store = createGameStore(2)
    store.acquire(book(1))
    const listener = vi.fn()
    store.subscribe(listener)
    store.acquire(book(1))
    expect(listener).not.toHaveBeenCalled()
  })

  it('여러 권을 한 번에 획득하면 한 번만 알린다', () => {
    const store = createGameStore(2)
    const listener = vi.fn()
    store.subscribe(listener)
    store.acquireMany([book(1), book(2), book(3)])
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getState().library.storage).toHaveLength(1)
  })

  it('구독을 해제하면 더 이상 알리지 않는다', () => {
    const store = createGameStore(1)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.acquire(book(1))
    expect(listener).not.toHaveBeenCalled()
  })

  it('테스트 도서를 직접 넣어도 독서 기록은 바뀌지 않는다', () => {
    const store = createGameStore(2)
    const before = store.getState().reading
    store.acquireMany([book(1), book(2)])
    expect(store.getState().reading).toBe(before)
  })
})

describe('apply', () => {
  it('성공한 동작은 상태를 바꾸고 구독자에게 한 번 알린다', () => {
    const store = createGameStore(3)
    const registered = store.apply((game) => registerBook(game, { title: '데미안', genre: '문학' }))
    expect(registered.ok).toBe(true)
    if (!registered.ok) return

    const listener = vi.fn()
    store.subscribe(listener)
    const started = store.apply((game) => startReading(game, registered.bookId))
    expect(started.ok).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getState().library.shelf.filter(Boolean)).toHaveLength(1)
  })

  it('실패한 동작은 상태를 바꾸지 않고 알리지도 않는다', () => {
    const store = createGameStore(3)
    const listener = vi.fn()
    store.subscribe(listener)
    const before = store.getState()

    const outcome = store.apply((game) => finishReading(game, 'book-없음'))

    expect(outcome.ok).toBe(false)
    expect(store.getState()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
  })

  it('독서 기록 변경이 도서관 도서를 함께 바꾼다', () => {
    const store = createGameStore(3)
    const registered = store.apply((game) => registerBook(game, { title: '데미안', genre: '문학' }))
    if (!registered.ok) throw new Error(registered.reason)
    store.apply((game) => startReading(game, registered.bookId))
    store.apply((game) => finishReading(game, registered.bookId))
    expect(store.getState().library.shelf.filter(Boolean)).toHaveLength(2)
  })
})

describe('reset', () => {
  it('독서 기록과 도서관을 모두 빈 상태로 되돌린다', () => {
    const store = createGameStore(2)
    store.apply((game) => registerBook(game, { title: '데미안', genre: '문학' }))
    store.acquireMany([book(1), book(2), book(3)])
    store.reset()
    expect(store.getState().library.shelf).toEqual([null, null])
    expect(store.getState().library.storage).toEqual([])
    expect(store.getState().reading).toEqual({ books: [], sessions: [], rewards: [], nextSeq: 1 })
  })
})

describe('초기 상태가 있는 저장소', () => {
  it('주어진 상태로 시작하고 초기화하면 빈 상태가 된다', () => {
    const first = createGameStore(2)
    first.acquire(book(1))
    const store = createGameStore(2, first.getState())
    expect(store.getState().library.shelf[0]?.id).toBe('b1')
    store.reset()
    expect(store.getState().library.shelf).toEqual([null, null])
  })

  it('용량이 다른 초기 상태는 거부한다', () => {
    const other = createGameStore(3).getState()
    expect(() => createGameStore(2, other)).toThrow(RangeError)
  })
})
