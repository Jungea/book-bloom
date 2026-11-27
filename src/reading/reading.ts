import {
  acquireBook,
  removeBook,
  renameBook,
  type LibraryState,
} from '../core/library'
import { isGenre, type Genre } from './genres'

/** 읽고 싶음 / 읽는 중 / 일시 중단 / 완독 / 하차 (docs/03). */
export type ReadingStatus = 'WANT' | 'READING' | 'PAUSED' | 'FINISHED' | 'DROPPED'

export interface RegisteredBook {
  readonly id: string
  readonly title: string
  readonly genre: Genre
}

/** 한 도서의 독서 회차. round 1이 첫 독서, 2 이상은 재독이다. */
export interface ReadingSession {
  readonly id: string
  readonly bookId: string
  readonly round: number
  readonly status: ReadingStatus
}

/** START: 도서당 최초 독서 시작, FINISH: 회차별 완독(1회차는 최초 완독, 이후는 재독 완료). */
export type RewardKind = 'START' | 'FINISH'

/** 게임 도서 1권을 지급한 이력. key가 같은 보상은 두 번 지급하지 않는다. */
export interface RewardRecord {
  readonly key: string
  readonly kind: RewardKind
  readonly bookId: string
  readonly sessionId: string
  readonly libraryBookId: string
}

export interface ReadingState {
  readonly books: readonly RegisteredBook[]
  readonly sessions: readonly ReadingSession[]
  readonly rewards: readonly RewardRecord[]
  readonly nextSeq: number
}

/** 독서 기록과 도서관을 함께 다루는 상태. 독서 기록의 변화가 도서관 도서를 늘리거나 줄인다. */
export interface Game {
  readonly reading: ReadingState
  readonly library: LibraryState
}

export type Outcome =
  | { readonly ok: true; readonly game: Game }
  | { readonly ok: false; readonly reason: string }

export type RegisterOutcome =
  | { readonly ok: true; readonly game: Game; readonly bookId: string }
  | { readonly ok: false; readonly reason: string }

export function createGame(library: LibraryState): Game {
  return { reading: { books: [], sessions: [], rewards: [], nextSeq: 1 }, library }
}

const ok = (game: Game): Outcome => ({ ok: true, game })
const fail = (reason: string) => ({ ok: false, reason }) as const

export function findBook(game: Game, bookId: string): RegisteredBook | undefined {
  return game.reading.books.find((book) => book.id === bookId)
}

/** 도서의 가장 최근(회차가 가장 큰) 독서 회차. */
export function latestSession(game: Game, bookId: string): ReadingSession | undefined {
  return game.reading.sessions
    .filter((session) => session.bookId === bookId)
    .reduce<ReadingSession | undefined>(
      (latest, session) => (latest && latest.round > session.round ? latest : session),
      undefined,
    )
}

function withReading(game: Game, changes: Partial<ReadingState>): Game {
  return { ...game, reading: { ...game.reading, ...changes } }
}

function setSessionStatus(game: Game, sessionId: string, status: ReadingStatus): Game {
  return withReading(game, {
    sessions: game.reading.sessions.map((session) =>
      session.id === sessionId ? { ...session, status } : session,
    ),
  })
}

function addSession(game: Game, bookId: string, round: number, status: ReadingStatus): {
  game: Game
  session: ReadingSession
} {
  const session: ReadingSession = { id: `session-${game.reading.nextSeq}`, bookId, round, status }
  return {
    game: withReading(game, {
      sessions: [...game.reading.sessions, session],
      nextSeq: game.reading.nextSeq + 1,
    }),
    session,
  }
}

/** 보상 1건을 지급한다. 같은 보상이 이미 지급되었으면 아무것도 하지 않는다. */
function grant(game: Game, kind: RewardKind, book: RegisteredBook, session: ReadingSession): Game {
  const key = kind === 'START' ? `start:${book.id}` : `finish:${session.id}`
  if (game.reading.rewards.some((reward) => reward.key === key)) return game

  const libraryBookId = `lib:${key}`
  const reward: RewardRecord = {
    key,
    kind,
    bookId: book.id,
    sessionId: session.id,
    libraryBookId,
  }
  return {
    reading: { ...game.reading, rewards: [...game.reading.rewards, reward] },
    library: acquireBook(game.library, { id: libraryBookId, title: book.title }),
  }
}

/** 조건에 맞는 보상을 회수한다. 도서관에서 해당 도서를 즉시 제거하고 지급 이력도 지운다. */
function revoke(game: Game, matches: (reward: RewardRecord) => boolean): Game {
  const revoked = game.reading.rewards.filter(matches)
  if (revoked.length === 0) return game
  return {
    reading: {
      ...game.reading,
      rewards: game.reading.rewards.filter((reward) => !matches(reward)),
    },
    library: revoked.reduce(
      (library, reward) => removeBook(library, reward.libraryBookId),
      game.library,
    ),
  }
}

export interface BookInput {
  readonly title: string
  readonly genre: string
}

function validateInput(input: Partial<BookInput>): string | null {
  if (input.title !== undefined && input.title.trim() === '') return '제목을 입력해야 합니다.'
  if (input.genre !== undefined && !isGenre(input.genre)) return '대표 장르를 선택해야 합니다.'
  return null
}

/** 도서를 등록한다. 등록만으로는 게임 도서를 얻지 않는다. 제목과 대표 장르는 필수다. */
export function registerBook(game: Game, input: BookInput): RegisterOutcome {
  const problem = validateInput(input)
  if (problem) return fail(problem)

  const book: RegisteredBook = {
    id: `book-${game.reading.nextSeq}`,
    title: input.title.trim(),
    genre: input.genre as Genre,
  }
  const next = withReading(game, {
    books: [...game.reading.books, book],
    nextSeq: game.reading.nextSeq + 1,
  })
  return { ok: true, game: next, bookId: book.id }
}

/** 제목·장르를 고친다. 제목을 바꾸면 이미 지급된 게임 도서의 제목도 따라 바뀐다. */
export function editBook(game: Game, bookId: string, changes: Partial<BookInput>): Outcome {
  const book = findBook(game, bookId)
  if (!book) return fail('등록되지 않은 도서입니다.')
  const problem = validateInput(changes)
  if (problem) return fail(problem)

  const title = changes.title?.trim() ?? book.title
  const genre = (changes.genre as Genre | undefined) ?? book.genre
  const library = game.reading.rewards
    .filter((reward) => reward.bookId === bookId)
    .reduce((state, reward) => renameBook(state, reward.libraryBookId, title), game.library)
  const reading = {
    ...game.reading,
    books: game.reading.books.map((b) => (b.id === bookId ? { ...b, title, genre } : b)),
  }
  return ok({ reading, library })
}

/** 읽고 싶은 책으로 담는다. 보상은 없다. 독서 기록이 아직 없는 도서만 가능하다. */
export function addToWishlist(game: Game, bookId: string): Outcome {
  if (!findBook(game, bookId)) return fail('등록되지 않은 도서입니다.')
  if (latestSession(game, bookId)) return fail('이미 독서 기록이 있는 도서입니다.')
  return ok(addSession(game, bookId, 1, 'WANT').game)
}

/**
 * 독서를 시작하거나 재개한다.
 * - 최초 시작(기록 없음 또는 읽고 싶음에서): 도서 +1권.
 * - 일시 중단·하차에서 재개: 추가 지급 없음.
 * - 완독 후 재독 시작: 새 회차를 만들며 추가 지급 없음.
 */
export function startReading(game: Game, bookId: string): Outcome {
  const book = findBook(game, bookId)
  if (!book) return fail('등록되지 않은 도서입니다.')

  const latest = latestSession(game, bookId)
  if (!latest) {
    const { game: added, session } = addSession(game, bookId, 1, 'READING')
    return ok(grant(added, 'START', book, session))
  }
  switch (latest.status) {
    case 'WANT':
      return ok(grant(setSessionStatus(game, latest.id, 'READING'), 'START', book, latest))
    case 'PAUSED':
    case 'DROPPED':
      return ok(setSessionStatus(game, latest.id, 'READING'))
    case 'FINISHED':
      return ok(addSession(game, bookId, latest.round + 1, 'READING').game)
    case 'READING':
      return fail('이미 읽는 중입니다.')
  }
}

export function pauseReading(game: Game, bookId: string): Outcome {
  const latest = latestSession(game, bookId)
  if (latest?.status !== 'READING') return fail('읽는 중인 도서만 일시 중단할 수 있습니다.')
  return ok(setSessionStatus(game, latest.id, 'PAUSED'))
}

export function dropReading(game: Game, bookId: string): Outcome {
  const latest = latestSession(game, bookId)
  if (latest?.status !== 'READING' && latest?.status !== 'PAUSED') {
    return fail('읽는 중이거나 일시 중단한 도서만 하차할 수 있습니다.')
  }
  return ok(setSessionStatus(game, latest.id, 'DROPPED'))
}

/** 완독을 확정한다. 1회차는 최초 완독, 이후 회차는 재독 완료로 각각 도서 +1권. */
export function finishReading(game: Game, bookId: string): Outcome {
  const book = findBook(game, bookId)
  const latest = latestSession(game, bookId)
  if (!book || latest?.status !== 'READING') return fail('읽는 중인 도서만 완독할 수 있습니다.')
  return ok(grant(setSessionStatus(game, latest.id, 'FINISHED'), 'FINISH', book, latest))
}

/** 완독을 취소한다. 그 회차의 완독 보상을 회수하고 다시 읽는 중으로 돌린다. */
export function cancelFinish(game: Game, bookId: string): Outcome {
  const latest = latestSession(game, bookId)
  if (latest?.status !== 'FINISHED') return fail('완독한 도서만 완독을 취소할 수 있습니다.')
  const reopened = setSessionStatus(game, latest.id, 'READING')
  return ok(revoke(reopened, (reward) => reward.kind === 'FINISH' && reward.sessionId === latest.id))
}

/** 독서 회차 하나를 삭제하고 그 회차에서 지급된 보상을 모두 회수한다. */
export function deleteSession(game: Game, sessionId: string): Outcome {
  if (!game.reading.sessions.some((session) => session.id === sessionId)) {
    return fail('없는 독서 회차입니다.')
  }
  const removed = withReading(game, {
    sessions: game.reading.sessions.filter((session) => session.id !== sessionId),
  })
  return ok(revoke(removed, (reward) => reward.sessionId === sessionId))
}

/** 도서를 삭제한다. 독서 회차와 지급된 게임 도서를 모두 제거한다. */
export function deleteBook(game: Game, bookId: string): Outcome {
  if (!findBook(game, bookId)) return fail('등록되지 않은 도서입니다.')
  const removed = withReading(game, {
    books: game.reading.books.filter((book) => book.id !== bookId),
    sessions: game.reading.sessions.filter((session) => session.bookId !== bookId),
  })
  return ok(revoke(removed, (reward) => reward.bookId === bookId))
}
