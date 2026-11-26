import {
  acquireBook,
  acquireBooks,
  createLibrary,
  type LibraryBook,
  type LibraryState,
} from './library'

export interface LibraryStore {
  getState(): LibraryState
  subscribe(listener: () => void): () => void
  acquire(book: LibraryBook): void
  acquireMany(books: readonly LibraryBook[]): void
  reset(): void
}

export function createLibraryStore(shelfCapacity: number, initial?: LibraryState): LibraryStore {
  if (initial && initial.shelfCapacity !== shelfCapacity) {
    throw new RangeError('초기 상태의 책장 용량이 저장소 용량과 다릅니다.')
  }
  let state = initial ?? createLibrary(shelfCapacity)
  const listeners = new Set<() => void>()

  const update = (next: LibraryState) => {
    if (next === state) return
    state = next
    listeners.forEach((listener) => listener())
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    acquire: (book) => update(acquireBook(state, book)),
    acquireMany: (books) => update(acquireBooks(state, books)),
    reset: () => update(createLibrary(shelfCapacity)),
  }
}
