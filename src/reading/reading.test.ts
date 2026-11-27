import { describe, expect, it } from 'vitest'
import { createLibrary, hasBook, shelvedCount, type LibraryState } from '../core/library'
import {
  addToWishlist,
  cancelFinish,
  createGame,
  deleteBook,
  deleteSession,
  dropReading,
  editBook,
  finishReading,
  latestSession,
  pauseReading,
  registerBook,
  startReading,
  type Game,
  type Outcome,
} from './reading'

/** 실패하면 테스트를 즉시 실패시키고, 성공하면 새 상태를 돌려준다. */
function must(outcome: Outcome): Game {
  if (!outcome.ok) throw new Error(`예상치 못한 실패: ${outcome.reason}`)
  return outcome.game
}

function newGame(capacity = 10): Game {
  return createGame(createLibrary(capacity))
}

function register(game: Game, title = '데미안', genre = '문학'): { game: Game; bookId: string } {
  const result = registerBook(game, { title, genre })
  if (!result.ok) throw new Error(result.reason)
  return { game: result.game, bookId: result.bookId }
}

const owned = (library: LibraryState) =>
  [...library.shelf, ...library.storage].filter((b) => b !== null).length

describe('도서 등록', () => {
  it('등록만으로는 게임 도서를 얻지 않는다', () => {
    const { game } = register(newGame())
    expect(owned(game.library)).toBe(0)
    expect(game.reading.books).toHaveLength(1)
  })

  it('제목 앞뒤 공백을 지운다', () => {
    const { game, bookId } = register(newGame(), '  데미안  ')
    expect(game.reading.books.find((b) => b.id === bookId)?.title).toBe('데미안')
  })

  it('제목이 비어 있으면 거부한다', () => {
    expect(registerBook(newGame(), { title: '   ', genre: '문학' }).ok).toBe(false)
  })

  it('대표 장르가 없거나 목록에 없으면 거부한다', () => {
    expect(registerBook(newGame(), { title: '책', genre: '' }).ok).toBe(false)
    expect(registerBook(newGame(), { title: '책', genre: '요리' }).ok).toBe(false)
  })

  it('등록할 때마다 서로 다른 id를 받는다', () => {
    const a = register(newGame())
    const b = register(a.game)
    expect(a.bookId).not.toBe(b.bookId)
  })
})

describe('읽고 싶은 책', () => {
  it('담아도 게임 도서는 늘지 않는다', () => {
    const { game, bookId } = register(newGame())
    const next = must(addToWishlist(game, bookId))
    expect(latestSession(next, bookId)?.status).toBe('WANT')
    expect(owned(next.library)).toBe(0)
  })

  it('이미 기록이 있으면 거부한다', () => {
    const { game, bookId } = register(newGame())
    const reading = must(startReading(game, bookId))
    expect(addToWishlist(reading, bookId).ok).toBe(false)
  })

  it('읽고 싶음에서 시작하면 도서 +1권을 받는다', () => {
    const { game, bookId } = register(newGame())
    const next = must(startReading(must(addToWishlist(game, bookId)), bookId))
    expect(latestSession(next, bookId)?.status).toBe('READING')
    expect(owned(next.library)).toBe(1)
  })
})

describe('독서 시작', () => {
  it('최초 시작하면 도서 +1권, 제목은 등록 도서와 같다', () => {
    const { game, bookId } = register(newGame())
    const next = must(startReading(game, bookId))
    expect(owned(next.library)).toBe(1)
    expect(next.library.shelf[0]?.title).toBe('데미안')
    expect(latestSession(next, bookId)).toMatchObject({ round: 1, status: 'READING' })
  })

  it('이미 읽는 중이면 거부하고 도서를 더 주지 않는다', () => {
    const { game, bookId } = register(newGame())
    const reading = must(startReading(game, bookId))
    expect(startReading(reading, bookId).ok).toBe(false)
    expect(owned(reading.library)).toBe(1)
  })

  it('등록되지 않은 도서는 거부한다', () => {
    expect(startReading(newGame(), 'book-404').ok).toBe(false)
  })
})

describe('일시 중단·하차·재개', () => {
  it('중단·하차해도 이미 받은 도서는 유지된다', () => {
    const { game, bookId } = register(newGame())
    const paused = must(pauseReading(must(startReading(game, bookId)), bookId))
    expect(owned(paused.library)).toBe(1)
    const dropped = must(dropReading(paused, bookId))
    expect(latestSession(dropped, bookId)?.status).toBe('DROPPED')
    expect(owned(dropped.library)).toBe(1)
  })

  it('재개해도 추가 도서를 주지 않고 같은 회차를 이어간다', () => {
    const { game, bookId } = register(newGame())
    const paused = must(pauseReading(must(startReading(game, bookId)), bookId))
    const resumed = must(startReading(paused, bookId))
    expect(owned(resumed.library)).toBe(1)
    expect(resumed.reading.sessions).toHaveLength(1)
    expect(latestSession(resumed, bookId)?.status).toBe('READING')

    const dropped = must(dropReading(resumed, bookId))
    const again = must(startReading(dropped, bookId))
    expect(owned(again.library)).toBe(1)
  })

  it('읽는 중이 아니면 중단·하차를 거부한다', () => {
    const { game, bookId } = register(newGame())
    expect(pauseReading(game, bookId).ok).toBe(false)
    expect(dropReading(game, bookId).ok).toBe(false)
  })
})

describe('완독', () => {
  it('최초 완독하면 도서 +1권을 더 받아 총 2권이 된다', () => {
    const { game, bookId } = register(newGame())
    const finished = must(finishReading(must(startReading(game, bookId)), bookId))
    expect(latestSession(finished, bookId)?.status).toBe('FINISHED')
    expect(owned(finished.library)).toBe(2)
  })

  it('읽는 중이 아니면 완독을 거부한다', () => {
    const { game, bookId } = register(newGame())
    expect(finishReading(game, bookId).ok).toBe(false)
    const paused = must(pauseReading(must(startReading(game, bookId)), bookId))
    expect(finishReading(paused, bookId).ok).toBe(false)
  })

  it('이미 완독한 도서를 다시 완독 처리해도 도서가 늘지 않는다', () => {
    const { game, bookId } = register(newGame())
    const finished = must(finishReading(must(startReading(game, bookId)), bookId))
    expect(finishReading(finished, bookId).ok).toBe(false)
    expect(owned(finished.library)).toBe(2)
  })
})

describe('재독', () => {
  function firstRoundDone() {
    const { game, bookId } = register(newGame())
    return { game: must(finishReading(must(startReading(game, bookId)), bookId)), bookId }
  }

  it('재독을 시작하면 새 회차가 생기고 도서는 늘지 않는다', () => {
    const { game, bookId } = firstRoundDone()
    const reread = must(startReading(game, bookId))
    expect(latestSession(reread, bookId)).toMatchObject({ round: 2, status: 'READING' })
    expect(reread.reading.sessions).toHaveLength(2)
    expect(owned(reread.library)).toBe(2)
  })

  it('재독을 완료하면 도서 +1권이다', () => {
    const { game, bookId } = firstRoundDone()
    const done = must(finishReading(must(startReading(game, bookId)), bookId))
    expect(owned(done.library)).toBe(3)
  })

  it('회차마다 완독 보상은 한 번씩만 받는다', () => {
    const { game, bookId } = firstRoundDone()
    let current = game
    for (let round = 2; round <= 4; round += 1) {
      current = must(finishReading(must(startReading(current, bookId)), bookId))
    }
    expect(owned(current.library)).toBe(2 + 3)
    expect(new Set(current.reading.rewards.map((r) => r.libraryBookId)).size).toBe(5)
  })
})

describe('완독 취소', () => {
  it('완독 보상만 회수하고 읽는 중으로 돌아간다', () => {
    const { game, bookId } = register(newGame())
    const finished = must(finishReading(must(startReading(game, bookId)), bookId))
    const cancelled = must(cancelFinish(finished, bookId))
    expect(latestSession(cancelled, bookId)?.status).toBe('READING')
    expect(owned(cancelled.library)).toBe(1)
    expect(hasBook(cancelled.library, 'lib:start:' + bookId)).toBe(true)
  })

  it('취소 후 다시 완독하면 보상을 다시 받는다', () => {
    const { game, bookId } = register(newGame())
    const finished = must(finishReading(must(startReading(game, bookId)), bookId))
    const again = must(finishReading(must(cancelFinish(finished, bookId)), bookId))
    expect(owned(again.library)).toBe(2)
  })

  it('재독 회차의 완독을 취소하면 그 회차 보상만 회수한다', () => {
    const { game, bookId } = register(newGame())
    const first = must(finishReading(must(startReading(game, bookId)), bookId))
    const second = must(finishReading(must(startReading(first, bookId)), bookId))
    expect(owned(second.library)).toBe(3)
    const cancelled = must(cancelFinish(second, bookId))
    expect(owned(cancelled.library)).toBe(2)
  })

  it('완독하지 않은 도서는 거부한다', () => {
    const { game, bookId } = register(newGame())
    expect(cancelFinish(must(startReading(game, bookId)), bookId).ok).toBe(false)
  })
})

describe('삭제와 회수', () => {
  it('독서 회차를 삭제하면 그 회차의 보상이 회수된다', () => {
    const { game, bookId } = register(newGame())
    const first = must(finishReading(must(startReading(game, bookId)), bookId))
    const second = must(finishReading(must(startReading(first, bookId)), bookId))
    const secondId = latestSession(second, bookId)!.id
    const next = must(deleteSession(second, secondId))
    expect(owned(next.library)).toBe(2)
    expect(next.reading.sessions).toHaveLength(1)
  })

  it('1회차를 삭제하면 최초 시작과 최초 완독 보상이 함께 회수된다', () => {
    const { game, bookId } = register(newGame())
    const finished = must(finishReading(must(startReading(game, bookId)), bookId))
    const next = must(deleteSession(finished, latestSession(finished, bookId)!.id))
    expect(owned(next.library)).toBe(0)
    expect(next.reading.rewards).toEqual([])
  })

  it('도서를 삭제하면 지급된 게임 도서가 모두 사라진다', () => {
    const { game, bookId } = register(newGame())
    const finished = must(finishReading(must(startReading(game, bookId)), bookId))
    const next = must(deleteBook(finished, bookId))
    expect(owned(next.library)).toBe(0)
    expect(next.reading.books).toEqual([])
    expect(next.reading.sessions).toEqual([])
  })

  it('다른 도서의 게임 도서는 건드리지 않는다', () => {
    const a = register(newGame(), '데미안')
    const b = register(a.game, '변신')
    const both = must(startReading(must(startReading(b.game, a.bookId)), b.bookId))
    const next = must(deleteBook(both, a.bookId))
    expect(owned(next.library)).toBe(1)
    expect(next.library.shelf.find((x) => x)?.title).toBe('변신')
  })

  it('없는 도서·회차 삭제는 거부한다', () => {
    expect(deleteBook(newGame(), 'book-404').ok).toBe(false)
    expect(deleteSession(newGame(), 'session-404').ok).toBe(false)
  })

  it('보관함에 있는 도서도 회수된다', () => {
    const { game, bookId } = register(newGame(1))
    const finished = must(finishReading(must(startReading(game, bookId)), bookId)) // 책장 1 + 보관함 1
    expect(finished.library.storage).toHaveLength(1)
    const next = must(deleteBook(finished, bookId))
    expect(owned(next.library)).toBe(0)
  })

  it('책장에서 회수되면 보관함 도서가 올라온다', () => {
    const a = register(newGame(1), '데미안')
    const b = register(a.game, '변신')
    // 책장 용량 1: a의 도서가 책장, b의 도서는 보관함
    const both = must(startReading(must(startReading(b.game, a.bookId)), b.bookId))
    expect(both.library.storage).toHaveLength(1)
    const next = must(deleteBook(both, a.bookId))
    expect(next.library.shelf[0]?.title).toBe('변신')
    expect(next.library.storage).toEqual([])
  })
})

describe('도서 수정', () => {
  it('제목을 바꾸면 지급된 게임 도서의 제목도 바뀐다', () => {
    const { game, bookId } = register(newGame(1))
    const finished = must(finishReading(must(startReading(game, bookId)), bookId))
    const next = must(editBook(finished, bookId, { title: '데미안(개정판)' }))
    expect(next.library.shelf[0]?.title).toBe('데미안(개정판)')
    expect(next.library.storage[0]?.title).toBe('데미안(개정판)')
    expect(owned(next.library)).toBe(2)
  })

  it('장르를 바꿔도 게임 도서는 그대로다', () => {
    const { game, bookId } = register(newGame())
    const started = must(startReading(game, bookId))
    const next = must(editBook(started, bookId, { genre: '인문' }))
    expect(next.reading.books[0].genre).toBe('인문')
    expect(next.library).toEqual(started.library)
  })

  it('잘못된 값은 거부하고 상태를 바꾸지 않는다', () => {
    const { game, bookId } = register(newGame())
    expect(editBook(game, bookId, { title: ' ' }).ok).toBe(false)
    expect(editBook(game, bookId, { genre: '요리' }).ok).toBe(false)
    expect(editBook(game, 'book-404', { title: 'x' }).ok).toBe(false)
  })
})

describe('상태 보존', () => {
  it('실패한 동작은 상태를 바꾸지 않는다', () => {
    const { game, bookId } = register(newGame())
    const before = JSON.stringify(game)
    pauseReading(game, bookId)
    cancelFinish(game, bookId)
    expect(JSON.stringify(game)).toBe(before)
  })

  it('복잡한 흐름 뒤에도 도서관의 도서 수가 보상 이력과 일치한다', () => {
    let game = newGame(2)
    const ids = ['데미안', '변신', '이방인'].map((title) => {
      const r = register(game, title)
      game = r.game
      return r.bookId
    })
    for (const id of ids) game = must(finishReading(must(startReading(game, id)), id))
    game = must(cancelFinish(game, ids[0]))
    game = must(deleteBook(game, ids[1]))
    expect(owned(game.library)).toBe(game.reading.rewards.length)
    expect(shelvedCount(game.library)).toBe(2)
  })
})
