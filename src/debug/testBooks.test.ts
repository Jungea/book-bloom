import { describe, expect, it } from 'vitest'
import { acquireBooks, createLibrary } from '../core/library'
import { createTestBooks, isTestBook, nextTestSerial } from './testBooks'

describe('테스트 도서', () => {
  it('번호가 이어지는 도서를 만든다', () => {
    expect(createTestBooks(3, 5).map((book) => book.id)).toEqual(['debug-5', 'debug-6', 'debug-7'])
  })

  it('테스트 도서만 테스트 도서로 인식한다', () => {
    expect(isTestBook({ id: 'debug-1', title: 'a' })).toBe(true)
    expect(isTestBook({ id: 'real-1', title: 'a' })).toBe(false)
  })

  it('빈 도서관은 1번부터 시작한다', () => {
    expect(nextTestSerial(createLibrary(2))).toBe(1)
  })

  it('책장과 보관함의 가장 큰 번호 다음을 돌려준다', () => {
    const state = acquireBooks(createLibrary(2), createTestBooks(5, 1))
    expect(nextTestSerial(state)).toBe(6)
  })

  it('실제 도서는 번호 계산에서 제외한다', () => {
    const state = acquireBooks(createLibrary(3), [
      { id: 'real-9', title: '실제 도서' },
      ...createTestBooks(2, 1),
    ])
    expect(nextTestSerial(state)).toBe(3)
  })
})
