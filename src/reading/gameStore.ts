import {
  acquireBook,
  acquireBooks,
  createLibrary,
  type LibraryBook,
} from '../core/library'
import { createGame, type Game, type Outcome, type RegisterOutcome } from './reading'

/**
 * 독서 기록과 도서관을 함께 들고 있는 상태 저장소.
 * 저장·화면 갱신은 이 저장소 하나를 구독한다. 둘이 따로 저장되어 어긋나는 일을 막는다.
 */
export interface GameStore {
  getState(): Game
  subscribe(listener: () => void): () => void
  /** 독서 기록 동작을 적용한다. 성공하면 상태를 바꾸고, 실패하면 상태를 그대로 두고 사유를 돌려준다. */
  apply<T extends Outcome | RegisterOutcome>(action: (game: Game) => T): T
  /** 도서관에 도서를 직접 넣는다. 독서 기록과 무관한 개발자 테스트 도서용이다. */
  acquire(book: LibraryBook): void
  acquireMany(books: readonly LibraryBook[]): void
  /** 독서 기록과 도서관을 모두 빈 상태로 되돌린다. */
  reset(): void
}

export function createGameStore(shelfCapacity: number, initial?: Game): GameStore {
  if (initial && initial.library.shelfCapacity !== shelfCapacity) {
    throw new RangeError('초기 상태의 책장 용량이 저장소 용량과 다릅니다.')
  }
  let state = initial ?? createGame(createLibrary(shelfCapacity))
  const listeners = new Set<() => void>()

  const update = (next: Game) => {
    if (next === state) return
    state = next
    // 구독자 하나가 예외를 던져도 나머지(저장, 화면 갱신)는 계속 알린다.
    listeners.forEach((listener) => {
      try {
        listener()
      } catch (error) {
        console.error('상태 구독자 처리 중 오류가 발생했습니다.', error)
      }
    })
  }

  const updateLibrary = (library: Game['library']) => {
    if (library !== state.library) update({ ...state, library })
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    apply(action) {
      const result = action(state)
      if (result.ok) update(result.game)
      return result
    },
    acquire: (book) => updateLibrary(acquireBook(state.library, book)),
    acquireMany: (books) => updateLibrary(acquireBooks(state.library, books)),
    reset: () => update(createGame(createLibrary(shelfCapacity))),
  }
}
