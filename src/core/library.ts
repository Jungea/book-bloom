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

/**
 * 도서 1권을 제거한다(독서 기록 변경으로 보상이 회수된 경우). 없는 id는 무시한다.
 * 다른 도서의 위치는 바꾸지 않는다. 책장에서 빠져 빈 슬롯이 생기면 보관함의 가장 오래된
 * 도서가 그 슬롯으로 올라온다.
 */
export function removeBook(state: LibraryState, bookId: string): LibraryState {
  const slot = state.shelf.findIndex((book) => book?.id === bookId)
  if (slot !== -1) {
    const shelf = state.shelf.slice()
    const [promoted, ...storage] = state.storage
    shelf[slot] = promoted ?? null
    return { ...state, shelf, storage }
  }
  if (state.storage.some((book) => book.id === bookId)) {
    return { ...state, storage: state.storage.filter((book) => book.id !== bookId) }
  }
  return state
}

/** 도서 제목을 바꾼다. 위치는 유지한다. 없는 id는 무시한다. */
export function renameBook(state: LibraryState, bookId: string, title: string): LibraryState {
  if (!hasBook(state, bookId)) return state
  const rename = (book: LibraryBook): LibraryBook => (book.id === bookId ? { ...book, title } : book)
  return {
    ...state,
    shelf: state.shelf.map((book) => (book ? rename(book) : null)),
    storage: state.storage.map(rename),
  }
}

export function storedCount(state: LibraryState): number {
  return state.storage.length
}

export function shelvedCount(state: LibraryState): number {
  return state.shelf.filter((book) => book !== null).length
}
