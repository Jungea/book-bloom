import { describe, expect, it } from 'vitest'
import { createLibrary } from '../core/library'
import { actionIcon } from './actionIcons'
import {
  addToWishlist,
  createGame,
  dropReading,
  finishReading,
  pauseReading,
  registerBook,
  startReading,
  type Game,
  type Outcome,
} from './reading'
import { bookActions } from './readingView'

function must(outcome: Outcome): Game {
  if (!outcome.ok) throw new Error(outcome.reason)
  return outcome.game
}

/** 도서 1권을 등록하고 원하는 독서 상태로 만든 게임. */
function gameIn(state: 'NONE' | 'WANT' | 'READING' | 'PAUSED' | 'DROPPED' | 'FINISHED'): { game: Game; bookId: string } {
  const registered = registerBook(createGame(createLibrary(5)), { title: '데미안', genre: '문학' })
  if (!registered.ok) throw new Error(registered.reason)
  const id = registered.bookId
  let game = registered.game
  if (state === 'NONE') return { game, bookId: id }
  if (state === 'WANT') return { game: must(addToWishlist(game, id)), bookId: id }
  game = must(startReading(game, id))
  if (state === 'PAUSED') game = must(pauseReading(game, id))
  if (state === 'DROPPED') game = must(dropReading(game, id))
  if (state === 'FINISHED') game = must(finishReading(game, id))
  return { game, bookId: id }
}

const STATES = ['NONE', 'WANT', 'READING', 'PAUSED', 'DROPPED', 'FINISHED'] as const

describe('actionIcon: 독서 상태 동작의 아이콘', () => {
  it('모든 독서 상태에서 나오는 모든 동작에 아이콘이 있다', () => {
    const labels = new Set<string>()
    for (const state of STATES) {
      const { game, bookId } = gameIn(state)
      bookActions(game, bookId).forEach((action) => labels.add(action.label))
    }
    // 시작·재개·재독 시작·완독·완독 취소 등 코어가 허용하는 모든 동작을 거쳤다.
    expect([...labels].sort()).toEqual(
      ['삭제', '시작', '읽고 싶음', '완독', '일시 중단', '재개', '재독 시작', '완독 취소', '하차'].sort(),
    )
    for (const label of labels) {
      expect(actionIcon(label), `${label}에 아이콘이 없다`).toBeDefined()
    }
  })

  it('아이콘만 쓰는 동작은 뜻이 분명한 삭제뿐이고 헷갈릴 수 있는 동작은 글자를 함께 보인다', () => {
    for (const label of ['읽고 싶음', '시작', '재개', '완독', '일시 중단', '하차', '재독 시작', '완독 취소']) {
      expect(actionIcon(label)?.iconOnly, `${label}은 아이콘과 글자를 함께 보여야 한다`).toBe(false)
    }
    expect(actionIcon('삭제')?.iconOnly).toBe(true)
  })

  it('특히 완독 취소·재독 시작은 서로 다른 아이콘과 글자를 함께 쓴다', () => {
    const undo = actionIcon('완독 취소')
    const repeat = actionIcon('재독 시작')
    expect(undo?.iconOnly).toBe(false)
    expect(repeat?.iconOnly).toBe(false)
    expect(undo?.icon).not.toBe(repeat?.icon)
  })

  it('모르는 동작 이름은 아이콘이 없어 글자만 있는 버튼으로 남는다', () => {
    expect(actionIcon('없는 동작')).toBeUndefined()
  })
})
