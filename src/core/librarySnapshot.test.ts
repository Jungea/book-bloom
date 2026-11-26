import { describe, expect, it } from 'vitest'
import { acquireBooks, createLibrary, type LibraryBook } from './library'
import { restoreLibrary, toSnapshot } from './librarySnapshot'

const book = (n: number): LibraryBook => ({ id: `b${n}`, title: `도서 ${n}` })
const books = (count: number, from = 1) => Array.from({ length: count }, (_, i) => book(from + i))
const ids = (list: readonly (LibraryBook | null)[]) => list.map((b) => b?.id ?? null)

function restored(raw: unknown, capacity: number) {
  const result = restoreLibrary(raw, capacity)
  if (!result.ok) throw new Error(`복원 실패: ${result.reason}`)
  return result.state
}

describe('저장과 복원', () => {
  it('저장했다가 복원하면 같은 상태가 된다', () => {
    const state = acquireBooks(createLibrary(3), books(5))
    expect(restored(JSON.parse(JSON.stringify(toSnapshot(state))), 3)).toEqual(state)
  })

  it('빈 도서관도 복원된다', () => {
    const state = createLibrary(4)
    expect(restored(toSnapshot(state), 4)).toEqual(state)
  })

  it('저장 데이터에 없는 필드는 무시한다', () => {
    const raw = { ...toSnapshot(acquireBooks(createLibrary(2), books(1))), extra: 'x' }
    expect(restored(raw, 2).shelf[0]?.id).toBe('b1')
  })
})

describe('책장 용량이 바뀐 경우', () => {
  it('줄어들면 넘치는 도서가 보관함 앞쪽으로 가고 남은 위치는 유지된다', () => {
    const state = acquireBooks(createLibrary(4), books(6)) // 책장 b1~b4, 보관함 b5 b6
    const next = restored(toSnapshot(state), 2)
    expect(ids(next.shelf)).toEqual(['b1', 'b2'])
    expect(next.storage.map((b) => b.id)).toEqual(['b3', 'b4', 'b5', 'b6'])
  })

  it('늘어나면 보관함 도서를 획득 순서대로 빈 슬롯에 채운다', () => {
    const state = acquireBooks(createLibrary(2), books(5)) // 책장 b1 b2, 보관함 b3 b4 b5
    const next = restored(toSnapshot(state), 4)
    expect(ids(next.shelf)).toEqual(['b1', 'b2', 'b3', 'b4'])
    expect(next.storage.map((b) => b.id)).toEqual(['b5'])
  })

  it('늘어나도 보관함이 비어 있으면 빈 슬롯은 그대로 둔다', () => {
    const state = acquireBooks(createLibrary(2), books(1))
    const next = restored(toSnapshot(state), 4)
    expect(ids(next.shelf)).toEqual(['b1', null, null, null])
    expect(next.storage).toEqual([])
  })

  it('용량이 같으면 도서 위치를 바꾸지 않는다', () => {
    const snapshot = {
      version: 1,
      shelfCapacity: 3,
      shelf: [null, book(2), book(1)],
      storage: [],
    }
    expect(ids(restored(snapshot, 3).shelf)).toEqual([null, 'b2', 'b1'])
  })

  it('복원한 도서관에서 도서는 한 권도 사라지거나 늘지 않는다', () => {
    const state = acquireBooks(createLibrary(5), books(9))
    for (const capacity of [0, 1, 3, 5, 8, 12]) {
      const next = restored(toSnapshot(state), capacity)
      const all = [...next.shelf, ...next.storage].filter((b): b is LibraryBook => b !== null)
      expect(all.map((b) => b.id).sort()).toEqual(books(9).map((b) => b.id).sort())
    }
  })
})

describe('깨진 저장 데이터', () => {
  const valid = () => toSnapshot(acquireBooks(createLibrary(2), books(3)))

  const cases: [string, unknown][] = [
    ['null', null],
    ['배열', []],
    ['문자열', 'broken'],
    ['버전 없음', { ...valid(), version: undefined }],
    ['미래 버전', { ...valid(), version: 2 }],
    ['용량이 음수', { ...valid(), shelfCapacity: -1 }],
    ['용량이 소수', { ...valid(), shelfCapacity: 1.5 }],
    ['슬롯 수와 용량 불일치', { ...valid(), shelfCapacity: 3 }],
    ['책장이 배열이 아님', { ...valid(), shelf: 'x' }],
    ['보관함이 배열이 아님', { ...valid(), storage: {} }],
    ['책장 도서에 id 없음', { ...valid(), shelf: [{ title: 't' }, null] }],
    ['책장 도서의 id가 빈 문자열', { ...valid(), shelf: [{ id: '', title: 't' }, null] }],
    ['보관함 도서의 제목이 숫자', { ...valid(), storage: [{ id: 'x', title: 1 }] }],
    ['id 중복', { ...valid(), storage: [book(1)] }],
  ]

  it.each(cases)('거부한다: %s', (_name, raw) => {
    const result = restoreLibrary(raw, 2)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).not.toBe('')
  })

  it('예외를 던지지 않는다', () => {
    for (const [, raw] of cases) expect(() => restoreLibrary(raw, 2)).not.toThrow()
  })
})
