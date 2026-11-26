import { describe, expect, it } from 'vitest'
import {
  acquireBook,
  acquireBooks,
  createLibrary,
  hasBook,
  removeBook,
  renameBook,
  shelvedCount,
  type LibraryBook,
} from './library'

const book = (n: number): LibraryBook => ({ id: `b${n}`, title: `도서 ${n}` })
const books = (count: number, from = 1) => Array.from({ length: count }, (_, i) => book(from + i))

describe('createLibrary', () => {
  it('빈 책장과 빈 보관함으로 시작한다', () => {
    const state = createLibrary(3)
    expect(state.shelf).toEqual([null, null, null])
    expect(state.storage).toEqual([])
  })

  it('잘못된 용량은 거부한다', () => {
    expect(() => createLibrary(-1)).toThrow(RangeError)
    expect(() => createLibrary(1.5)).toThrow(RangeError)
    expect(() => createLibrary(Number.NaN)).toThrow(RangeError)
  })
})

describe('acquireBook', () => {
  it('획득 순서대로 앞쪽 빈 슬롯부터 배치한다', () => {
    const state = acquireBooks(createLibrary(3), books(2))
    expect(state.shelf.map((b) => b?.id ?? null)).toEqual(['b1', 'b2', null])
    expect(state.storage).toEqual([])
  })

  it('책장이 가득 차면 보관함에 획득 순서대로 쌓는다', () => {
    const state = acquireBooks(createLibrary(2), books(5))
    expect(state.shelf.map((b) => b?.id)).toEqual(['b1', 'b2'])
    expect(state.storage.map((b) => b.id)).toEqual(['b3', 'b4', 'b5'])
  })

  it('용량이 0이면 모두 보관함으로 간다', () => {
    const state = acquireBooks(createLibrary(0), books(2))
    expect(state.shelf).toEqual([])
    expect(state.storage.map((b) => b.id)).toEqual(['b1', 'b2'])
  })

  it('같은 id는 책장에 있어도 보관함에 있어도 한 번만 인정한다', () => {
    let state = acquireBooks(createLibrary(1), books(2))
    const before = state
    state = acquireBook(state, book(1))
    state = acquireBook(state, book(2))
    expect(state).toBe(before)
    expect(shelvedCount(state)).toBe(1)
    expect(state.storage).toHaveLength(1)
  })

  it('기존 도서의 위치를 바꾸지 않는다', () => {
    const first = acquireBooks(createLibrary(4), books(3))
    const next = acquireBook(first, book(4))
    expect(next.shelf.slice(0, 3)).toEqual(first.shelf.slice(0, 3))
    expect(next.shelf[3]?.id).toBe('b4')
  })

  it('원래 상태를 변경하지 않는다', () => {
    const state = createLibrary(2)
    acquireBooks(state, books(4))
    expect(state.shelf).toEqual([null, null])
    expect(state.storage).toEqual([])
  })

  it('획득한 도서는 hasBook으로 확인된다', () => {
    const state = acquireBooks(createLibrary(1), books(2))
    expect(hasBook(state, 'b1')).toBe(true)
    expect(hasBook(state, 'b2')).toBe(true)
    expect(hasBook(state, 'b3')).toBe(false)
  })
})

describe('removeBook', () => {
  it('책장 도서를 제거하면 그 자리만 비고 다른 도서는 움직이지 않는다', () => {
    const state = acquireBooks(createLibrary(4), books(3))
    const next = removeBook(state, 'b2')
    expect(next.shelf.map((b) => b?.id ?? null)).toEqual(['b1', null, 'b3', null])
  })

  it('책장에서 빠져 빈 슬롯이 생기면 보관함의 가장 오래된 도서가 올라온다', () => {
    const state = acquireBooks(createLibrary(2), books(4)) // 책장 b1 b2, 보관함 b3 b4
    const next = removeBook(state, 'b1')
    expect(next.shelf.map((b) => b?.id)).toEqual(['b3', 'b2'])
    expect(next.storage.map((b) => b.id)).toEqual(['b4'])
  })

  it('보관함 도서를 제거해도 책장은 그대로다', () => {
    const state = acquireBooks(createLibrary(1), books(3))
    const next = removeBook(state, 'b2')
    expect(next.shelf.map((b) => b?.id)).toEqual(['b1'])
    expect(next.storage.map((b) => b.id)).toEqual(['b3'])
  })

  it('없는 도서는 상태를 바꾸지 않는다', () => {
    const state = acquireBooks(createLibrary(2), books(1))
    expect(removeBook(state, 'zzz')).toBe(state)
  })

  it('제거한 자리는 다음 획득이 앞쪽 빈 슬롯부터 채운다', () => {
    const state = removeBook(acquireBooks(createLibrary(3), books(3)), 'b1')
    const next = acquireBook(state, book(9))
    expect(next.shelf.map((b) => b?.id)).toEqual(['b9', 'b2', 'b3'])
  })

  it('원래 상태를 변경하지 않는다', () => {
    const state = acquireBooks(createLibrary(2), books(2))
    removeBook(state, 'b1')
    expect(state.shelf.map((b) => b?.id)).toEqual(['b1', 'b2'])
  })
})

describe('renameBook', () => {
  it('책장과 보관함의 도서 제목을 바꾸고 위치는 유지한다', () => {
    const state = acquireBooks(createLibrary(1), books(2))
    const next = renameBook(renameBook(state, 'b1', '새 제목 1'), 'b2', '새 제목 2')
    expect(next.shelf[0]).toEqual({ id: 'b1', title: '새 제목 1' })
    expect(next.storage[0]).toEqual({ id: 'b2', title: '새 제목 2' })
  })

  it('없는 도서는 상태를 바꾸지 않는다', () => {
    const state = acquireBooks(createLibrary(1), books(1))
    expect(renameBook(state, 'zzz', 'x')).toBe(state)
  })
})
