import { describe, expect, it } from 'vitest'
import { createLibrary } from '../core/library'
import {
  createGame,
  dropReading,
  finishReading,
  pauseReading,
  registerBook,
  startReading,
  type Game,
  type Outcome,
} from './reading'
import { bookActions, libraryBookCount, readingStatusLabel, rewardMessage } from './readingView'

function must(outcome: Outcome): Game {
  if (!outcome.ok) throw new Error(outcome.reason)
  return outcome.game
}

function registered(capacity = 5): { game: Game; bookId: string } {
  const result = registerBook(createGame(createLibrary(capacity)), { title: '데미안', genre: '문학' })
  if (!result.ok) throw new Error(result.reason)
  return { game: result.game, bookId: result.bookId }
}

const labels = (game: Game, bookId: string) => bookActions(game, bookId).map((a) => a.label)

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
    expect(readingStatusLabel(must(startReading(finished, bookId)), bookId)).toBe('읽는 중 · 2회차')
  })
})

describe('bookActions', () => {
  it('기록이 없으면 읽고 싶음 담기와 시작을 할 수 있다', () => {
    const { game, bookId } = registered()
    expect(labels(game, bookId)).toEqual(['읽고 싶음', '시작', '삭제'])
  })

  it('읽고 싶음이면 시작할 수 있다', () => {
    const { game, bookId } = registered()
    const wanted = must(bookActions(game, bookId)[0].run(game))
    expect(readingStatusLabel(wanted, bookId)).toBe('읽고 싶음 · 1회차')
    expect(labels(wanted, bookId)).toEqual(['시작', '삭제'])
  })

  it('읽는 중이면 완독·일시 중단·하차를 할 수 있다', () => {
    const { game, bookId } = registered()
    expect(labels(must(startReading(game, bookId)), bookId)).toEqual(['완독', '일시 중단', '하차', '삭제'])
  })

  it('일시 중단이면 재개·하차를 할 수 있다', () => {
    const { game, bookId } = registered()
    const paused = must(pauseReading(must(startReading(game, bookId)), bookId))
    expect(labels(paused, bookId)).toEqual(['재개', '하차', '삭제'])
  })

  it('하차하면 재개할 수 있다', () => {
    const { game, bookId } = registered()
    const dropped = must(dropReading(must(startReading(game, bookId)), bookId))
    expect(labels(dropped, bookId)).toEqual(['재개', '삭제'])
  })

  it('완독이면 재독 시작과 완독 취소를 할 수 있다', () => {
    const { game, bookId } = registered()
    const finished = must(finishReading(must(startReading(game, bookId)), bookId))
    expect(labels(finished, bookId)).toEqual(['재독 시작', '완독 취소', '삭제'])
  })

  it('보상을 회수하는 동작은 확인을 받는다', () => {
    const { game, bookId } = registered()
    const finished = must(finishReading(must(startReading(game, bookId)), bookId))
    const byLabel = (label: string) => bookActions(finished, bookId).find((a) => a.label === label)!

    expect(byLabel('완독 취소').confirm).toContain('1권')
    expect(byLabel('삭제').confirm).toContain('2권')
    expect(byLabel('삭제').danger).toBe(true)
    expect(byLabel('재독 시작').confirm).toBeUndefined()
  })

  it('받은 도서가 없으면 삭제 확인에 회수 문구가 없다', () => {
    const { game, bookId } = registered()
    const remove = bookActions(game, bookId).find((a) => a.label === '삭제')!
    expect(remove.confirm).not.toContain('회수')
  })

  it('삭제는 항상 마지막이다', () => {
    const { game, bookId } = registered()
    const states = [
      game,
      must(startReading(game, bookId)),
      must(finishReading(must(startReading(game, bookId)), bookId)),
    ]
    for (const state of states) expect(labels(state, bookId).at(-1)).toBe('삭제')
  })
})

describe('rewardMessage', () => {
  it('도서가 늘면 +n권을 알린다', () => {
    const { game, bookId } = registered()
    const started = must(startReading(game, bookId))
    expect(libraryBookCount(started)).toBe(1)
    expect(rewardMessage(game, started)).toBe('도서관 도서 +1권')
  })

  it('도서가 줄면 -n권을 알린다', () => {
    const { game, bookId } = registered()
    const finished = must(finishReading(must(startReading(game, bookId)), bookId))
    const cancelled = must(bookActions(finished, bookId).find((a) => a.label === '완독 취소')!.run(finished))
    expect(rewardMessage(finished, cancelled)).toBe('도서관 도서 -1권')
  })

  it('보관함으로 넘어간 도서도 센다', () => {
    const { game, bookId } = registered(1)
    const finished = must(finishReading(must(startReading(game, bookId)), bookId))
    expect(finished.library.storage).toHaveLength(1)
    expect(libraryBookCount(finished)).toBe(2)
  })

  it('변화가 없으면 알리지 않는다', () => {
    const { game, bookId } = registered()
    const started = must(startReading(game, bookId))
    const paused = must(pauseReading(started, bookId))
    expect(rewardMessage(started, paused)).toBeNull()
  })
})
