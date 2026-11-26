import { describe, expect, it } from 'vitest'
import { acquireBooks, createLibrary } from '../core/library'
import { toSnapshot } from '../core/librarySnapshot'
import { GAME_SNAPSHOT_VERSION, restoreGame, toGameSnapshot } from './gameSnapshot'
import { createGame, finishReading, registerBook, startReading, type Game } from './reading'

function ok(outcome: { ok: true; game: Game } | { ok: false; reason: string }): Game {
  if (!outcome.ok) throw new Error(outcome.reason)
  return outcome.game
}

/** 도서 1권을 등록해 시작·완독까지 한 게임(도서관에 2권). */
function finishedGame(capacity = 5): { game: Game; bookId: string } {
  const registered = registerBook(createGame(createLibrary(capacity)), {
    title: '데미안',
    genre: '문학',
  })
  if (!registered.ok) throw new Error(registered.reason)
  const started = ok(startReading(registered.game, registered.bookId))
  return { game: ok(finishReading(started, registered.bookId)), bookId: registered.bookId }
}

/** JSON을 거쳐 저장소에서 읽어 온 것처럼 만든다. */
const roundTrip = (value: unknown): any => JSON.parse(JSON.stringify(value))

describe('toGameSnapshot / restoreGame', () => {
  it('독서 기록과 도서관이 그대로 복원된다', () => {
    const { game } = finishedGame()
    const result = restoreGame(roundTrip(toGameSnapshot(game)), 5)
    expect(result).toEqual({ ok: true, game })
  })

  it('빈 게임도 복원된다', () => {
    const game = createGame(createLibrary(3))
    expect(restoreGame(roundTrip(toGameSnapshot(game)), 3)).toEqual({ ok: true, game })
  })

  it('현재 저장 형식 버전은 2다', () => {
    expect(toGameSnapshot(createGame(createLibrary(1))).version).toBe(GAME_SNAPSHOT_VERSION)
    expect(GAME_SNAPSHOT_VERSION).toBe(2)
  })

  it('복원한 뒤에도 새 도서·회차 id가 기존 것과 겹치지 않는다', () => {
    const { game } = finishedGame()
    const restored = restoreGame(roundTrip(toGameSnapshot(game)), 5)
    if (!restored.ok) throw new Error(restored.reason)
    const next = registerBook(restored.game, { title: '다른 책', genre: '인문' })
    expect(next.ok).toBe(true)
    if (next.ok) {
      const ids = next.game.reading.books.map((b) => b.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('책장 용량이 달라도 독서 기록은 유지하고 도서는 용량에 맞춘다', () => {
    const { game } = finishedGame(5)
    const result = restoreGame(roundTrip(toGameSnapshot(game)), 1)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.game.reading).toEqual(game.reading)
      expect(result.game.library.shelf.filter(Boolean)).toHaveLength(1)
      expect(result.game.library.storage).toHaveLength(1)
    }
  })
})

describe('이전 형식(v1) 호환', () => {
  it('도서관만 저장된 v1은 독서 기록이 빈 상태로 복원된다', () => {
    const library = acquireBooks(createLibrary(3), [{ id: 'b1', title: '도서 1' }])
    const result = restoreGame(roundTrip(toSnapshot(library)), 3)
    expect(result).toEqual({ ok: true, game: createGame(library) })
  })

  it('깨진 v1은 실패한다', () => {
    const result = restoreGame({ version: 1, shelfCapacity: 3, shelf: 'x', storage: [] }, 3)
    expect(result.ok).toBe(false)
  })
})

describe('깨진 데이터는 실패 결과를 돌려준다', () => {
  const valid = () => roundTrip(toGameSnapshot(finishedGame().game))
  const fails = (raw: unknown) => expect(restoreGame(raw, 5).ok).toBe(false)

  it('객체가 아니거나 버전을 알 수 없다', () => {
    fails(null)
    fails('x')
    fails([])
    fails({ version: 99 })
    fails({})
  })

  it('도서관 또는 독서 기록이 없다', () => {
    const noLibrary = valid()
    delete noLibrary.library
    fails(noLibrary)
    const noReading = valid()
    delete noReading.reading
    fails(noReading)
  })

  it('도서관 부분이 깨졌다', () => {
    const raw = valid()
    raw.library.shelf = 'x'
    fails(raw)
  })

  it('등록 도서의 장르·제목·id가 올바르지 않다', () => {
    for (const patch of [{ genre: '없는장르' }, { title: '' }, { id: '' }, { title: 5 }]) {
      const raw = valid()
      Object.assign(raw.reading.books[0], patch)
      fails(raw)
    }
  })

  it('독서 회차의 상태·회차 번호가 올바르지 않다', () => {
    for (const patch of [{ status: 'DONE' }, { round: 0 }, { round: 1.5 }, { round: '1' }]) {
      const raw = valid()
      Object.assign(raw.reading.sessions[0], patch)
      fails(raw)
    }
  })

  it('보상 이력의 종류가 올바르지 않다', () => {
    const raw = valid()
    raw.reading.rewards[0].kind = 'BONUS'
    fails(raw)
  })

  it('목록이 배열이 아니다', () => {
    for (const key of ['books', 'sessions', 'rewards']) {
      const raw = valid()
      raw.reading[key] = {}
      fails(raw)
    }
  })

  it('일련번호가 올바르지 않다', () => {
    for (const nextSeq of [0, -1, 1.5, '3', undefined]) {
      const raw = valid()
      raw.reading.nextSeq = nextSeq
      fails(raw)
    }
  })

  it('이미 쓰인 id보다 일련번호가 작거나 같으면 실패한다', () => {
    const raw = valid()
    raw.reading.nextSeq = 2 // book-1, session-2가 이미 있다
    fails(raw)
  })

  it('중복된 id나 보상 키가 있다', () => {
    const dupBook = valid()
    dupBook.reading.books.push({ ...dupBook.reading.books[0] })
    fails(dupBook)

    const dupSession = valid()
    dupSession.reading.sessions.push({ ...dupSession.reading.sessions[0], round: 2 })
    fails(dupSession)

    const dupReward = valid()
    dupReward.reading.rewards.push({ ...dupReward.reading.rewards[0] })
    fails(dupReward)
  })

  it('같은 도서에 같은 회차가 두 번 있다', () => {
    const raw = valid()
    raw.reading.sessions.push({ ...raw.reading.sessions[0], id: 'session-99' })
    raw.reading.nextSeq = 100
    fails(raw)
  })

  it('없는 도서나 회차를 가리킨다', () => {
    const orphanSession = valid()
    orphanSession.reading.sessions[0].bookId = 'book-없음'
    fails(orphanSession)

    const orphanRewardBook = valid()
    orphanRewardBook.reading.rewards[0].bookId = 'book-없음'
    fails(orphanRewardBook)

    const orphanRewardSession = valid()
    orphanRewardSession.reading.rewards[0].sessionId = 'session-없음'
    fails(orphanRewardSession)
  })

  it('보상으로 지급된 도서가 도서관에 없다', () => {
    const raw = valid()
    raw.reading.rewards[0].libraryBookId = 'lib:없는도서'
    fails(raw)
  })
})
