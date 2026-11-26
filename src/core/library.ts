export interface LibraryBook {
  readonly id: string
  readonly title: string
}

export interface LibraryState {
  readonly shelfCapacity: number
  /** 인덱스가 책장 슬롯 번호이며 빈 슬롯은 null이다. */
  readonly shelf: readonly (LibraryBook | null)[]
  /** 책장에 자리가 없어 넘어온 도서를 획득 순서대로 보관한다. */
  readonly storage: readonly LibraryBook[]
}

export function createLibrary(shelfCapacity: number): LibraryState {
  if (!Number.isInteger(shelfCapacity) || shelfCapacity < 0) {
    throw new RangeError(`책장 용량은 0 이상의 정수여야 합니다: ${shelfCapacity}`)
  }
  return {
    shelfCapacity,
    shelf: Array.from({ length: shelfCapacity }, () => null),
    storage: [],
  }
}

export function hasBook(state: LibraryState, bookId: string): boolean {
  return (
    state.shelf.some((book) => book?.id === bookId) ||
    state.storage.some((book) => book.id === bookId)
  )
}

/**
 * 도서 1권을 획득한다. 같은 id는 한 번만 인정한다.
 * 비어 있는 첫 슬롯에 놓고, 빈 슬롯이 없으면 보관함에 넣는다.
 * 기존 도서의 위치는 바꾸지 않는다.
 */
export function acquireBook(state: LibraryState, book: LibraryBook): LibraryState {
  if (hasBook(state, book.id)) return state

  const slot = state.shelf.indexOf(null)
  if (slot === -1) {
    return { ...state, storage: [...state.storage, book] }
  }
  const shelf = state.shelf.slice()
  shelf[slot] = book
  return { ...state, shelf }
}

export function acquireBooks(state: LibraryState, books: readonly LibraryBook[]): LibraryState {
  return books.reduce(acquireBook, state)
}

export function shelvedCount(state: LibraryState): number {
  return state.shelf.filter((book) => book !== null).length
}
