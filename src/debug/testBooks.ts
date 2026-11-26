import type { LibraryBook, LibraryState } from '../core/library'

// 테스트 도서는 id 접두사로 실제 도서와 구분한다. 실제 독서 기록과 섞이지 않게 한다.
export const TEST_BOOK_PREFIX = 'debug-'

export function isTestBook(book: LibraryBook): boolean {
  return book.id.startsWith(TEST_BOOK_PREFIX)
}

/** 이미 도서관에 있는 테스트 도서의 다음 번호. 같은 id를 다시 만들어 중복으로 무시되지 않게 한다. */
export function nextTestSerial(state: LibraryState): number {
  const owned = [...state.shelf, ...state.storage].filter(
    (book): book is LibraryBook => book !== null && isTestBook(book),
  )
  const serials = owned.map((book) => Number(book.id.slice(TEST_BOOK_PREFIX.length)))
  return Math.max(0, ...serials.filter(Number.isFinite)) + 1
}

export function createTestBooks(count: number, startSerial: number): LibraryBook[] {
  return Array.from({ length: count }, (_, i) => {
    const serial = startSerial + i
    return { id: `${TEST_BOOK_PREFIX}${serial}`, title: `테스트 도서 ${serial}` }
  })
}
