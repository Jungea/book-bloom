import { describe, expect, it } from 'vitest'
import { createLibrary } from '../core/library'
import { GENRES } from '../reading/genres'
import {
  addToWishlist,
  createGame,
  finishReading,
  pauseReading,
  registerBook,
  startReading,
  type Game,
  type Outcome,
} from '../reading/reading'
import { readingActions, readingStatusLabel, testBookInput } from './readingActions'

function must(outcome: Outcome): Game {
  if (!outcome.ok) throw new Error(outcome.reason)
  return outcome.game
}

function registered(): { game: Game; bookId: string } {
  const result = registerBook(createGame(createLibrary(5)), { title: '데미안', genre: '문학' })
  if (!result.ok) throw new Error(result.reason)
  return { game: result.game, bookId: result.bookId }
}

const labels = (game: Game, bookId: string) => readingActions(game, bookId).map((a) => a.label)

describe('readingStatusLabel', () => {
  it('기록이 없으면 "기록 없음"이다', () => {
    const { game, bookId } = registered()
    expect(readingStatusLabel(game, bookId)).toBe('기록 없음')
  })

  it('상태와 회차를 보여 준다', () => {
    const { game, bookId } = registered()
    const reading = must(startReading(game, bookId))
    expect(readingStatusLabel(reading, bookId)).toBe('읽는 중 · 1회차')
    const finished = must(finishReading(reading, bookId))
    expect(readingStatusLabel(finished, bookId)).toBe('완독 · 1회차')
    const again = must(startReading(finished, bookId))
    expect(readingStatusLabel(again, bookId)).toBe('읽는 중 · 2회차')
  })
})

describe('readingActions', () => {
  it('기록이 없거나 읽고 싶음이면 시작할 수 있다', () => {
    const { game, bookId } = registered()
    expect(labels(game, bookId)).toEqual(['시작', '삭제'])
    expect(labels(must(addToWishlist(game, bookId)), bookId)).toEqual(['시작', '삭제'])
  })

  it('읽는 중이면 완독할 수 있다', () => {
    const { game, bookId } = registered()
    expect(labels(must(startReading(game, bookId)), bookId)).toEqual(['완독', '삭제'])
  })

  it('일시 중단이면 재개할 수 있다', () => {
    const { game, bookId } = registered()
    const paused = must(pauseReading(must(startReading(game, bookId)), bookId))
    expect(labels(paused, bookId)).toEqual(['재개', '삭제'])
  })

  it('완독이면 재독 시작과 완독 취소를 할 수 있다', () => {
    const { game, bookId } = registered()
    const finished = must(finishReading(must(startReading(game, bookId)), bookId))
    expect(labels(finished, bookId)).toEqual(['재독 시작', '완독 취소', '삭제'])
  })

  it('버튼은 실제 코어를 호출해 도서관 도서를 바꾼다', () => {
    const { game, bookId } = registered()
    const run = (current: Game, label: string) =>
      must(readingActions(current, bookId).find((a) => a.label === label)!.run(current))

    const started = run(game, '시작')
    expect(started.library.shelf.filter(Boolean)).toHaveLength(1)
    const finished = run(started, '완독')
    expect(finished.library.shelf.filter(Boolean)).toHaveLength(2)
    const cancelled = run(finished, '완독 취소')
    expect(cancelled.library.shelf.filter(Boolean)).toHaveLength(1)
    const removed = run(cancelled, '삭제')
    expect(removed.library.shelf.filter(Boolean)).toHaveLength(0)
    expect(removed.reading.books).toEqual([])
  })
})

describe('testBookInput', () => {
  it('제목과 대표 장르가 있어 등록이 통과한다', () => {
    const game = createGame(createLibrary(3))
    const input = testBookInput(game)
    expect(GENRES).toContain(input.genre)
    expect(registerBook(game, input).ok).toBe(true)
  })

  it('등록할 때마다 다른 제목을 만든다', () => {
    const first = registerBook(createGame(createLibrary(3)), testBookInput(createGame(createLibrary(3))))
    if (!first.ok) throw new Error(first.reason)
    expect(testBookInput(first.game).title).not.toBe(first.game.reading.books[0].title)
  })
})
