import { hasBook } from '../core/library'
import { restoreLibrary, SNAPSHOT_VERSION as LIBRARY_SNAPSHOT_VERSION } from '../core/librarySnapshot'
import type { LibraryBook } from '../core/library'
import { isGenre } from './genres'
import {
  createGame,
  type Game,
  type ReadingSession,
  type ReadingState,
  type ReadingStatus,
  type RegisteredBook,
  type RewardKind,
  type RewardRecord,
} from './reading'

/** 저장 형식 버전. 구조를 바꾸면 올리고 이전 버전을 읽는 마이그레이션을 `restoreGame`에 추가한다. */
export const GAME_SNAPSHOT_VERSION = 2

/**
 * 저장소에 넣는 게임 상태. 독서 기록과 도서관을 한 덩어리로 저장한다.
 * v1은 도서관만 저장하던 형식이며 `restoreGame`이 독서 기록이 빈 상태로 읽는다.
 */
export interface GameSnapshot {
  readonly version: typeof GAME_SNAPSHOT_VERSION
  readonly library: {
    readonly shelfCapacity: number
    readonly shelf: readonly (LibraryBook | null)[]
    readonly storage: readonly LibraryBook[]
  }
  readonly reading: ReadingState
}

export type RestoreGameResult =
  | { readonly ok: true; readonly game: Game }
  | { readonly ok: false; readonly reason: string }

export function toGameSnapshot(game: Game): GameSnapshot {
  const { shelfCapacity, shelf, storage } = game.library
  return {
    version: GAME_SNAPSHOT_VERSION,
    library: { shelfCapacity, shelf, storage },
    reading: game.reading,
  }
}

const STATUSES: readonly ReadingStatus[] = ['WANT', 'READING', 'PAUSED', 'FINISHED', 'DROPPED']
const REWARD_KINDS: readonly RewardKind[] = ['START', 'FINISH']

type Parsed<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

const bad = (reason: string): { ok: false; reason: string } => ({ ok: false, reason })

function parseArray<T>(
  raw: unknown,
  label: string,
  parseOne: (entry: unknown) => T | null,
): Parsed<T[]> {
  if (!Array.isArray(raw)) return bad(`${label}이(가) 배열이 아닙니다.`)
  const values: T[] = []
  for (const entry of raw) {
    const value = parseOne(entry)
    if (value === null) return bad(`${label}에 올바르지 않은 항목이 있습니다.`)
    values.push(value)
  }
  return { ok: true, value: values }
}

function parseBook(entry: unknown): RegisteredBook | null {
  if (!isRecord(entry)) return null
  const { id, title, genre } = entry
  if (!isNonEmptyString(id) || !isNonEmptyString(title) || !isGenre(genre)) return null
  return { id, title, genre }
}

function parseSession(entry: unknown): ReadingSession | null {
  if (!isRecord(entry)) return null
  const { id, bookId, round, status } = entry
  if (!isNonEmptyString(id) || !isNonEmptyString(bookId)) return null
  if (!Number.isInteger(round) || (round as number) < 1) return null
  if (!STATUSES.includes(status as ReadingStatus)) return null
  return { id, bookId, round: round as number, status: status as ReadingStatus }
}

function parseReward(entry: unknown): RewardRecord | null {
  if (!isRecord(entry)) return null
  const { key, kind, bookId, sessionId, libraryBookId } = entry
  if (!isNonEmptyString(key) || !REWARD_KINDS.includes(kind as RewardKind)) return null
  if (!isNonEmptyString(bookId) || !isNonEmptyString(sessionId) || !isNonEmptyString(libraryBookId)) {
    return null
  }
  return { key, kind: kind as RewardKind, bookId, sessionId, libraryBookId }
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length
}

/** 저장된 독서 기록을 검증한다. 서로 가리키는 값이 어긋나 있으면 실패로 본다. */
function parseReading(raw: unknown, library: Game['library']): Parsed<ReadingState> {
  if (!isRecord(raw)) return bad('독서 기록이 객체가 아닙니다.')

  const books = parseArray(raw.books, '등록 도서', parseBook)
  if (!books.ok) return books
  const sessions = parseArray(raw.sessions, '독서 회차', parseSession)
  if (!sessions.ok) return sessions
  const rewards = parseArray(raw.rewards, '보상 이력', parseReward)
  if (!rewards.ok) return rewards

  const { nextSeq } = raw
  if (!Number.isInteger(nextSeq) || (nextSeq as number) < 1) {
    return bad('저장된 일련번호가 올바르지 않습니다.')
  }

  if (hasDuplicates(books.value.map((book) => book.id))) return bad('같은 id의 등록 도서가 있습니다.')
  if (hasDuplicates(sessions.value.map((session) => session.id))) {
    return bad('같은 id의 독서 회차가 있습니다.')
  }
  if (hasDuplicates(rewards.value.map((reward) => reward.key))) return bad('같은 보상 이력이 중복되어 있습니다.')

  const bookIds = new Set(books.value.map((book) => book.id))
  const sessionIds = new Set(sessions.value.map((session) => session.id))
  if (sessions.value.some((session) => !bookIds.has(session.bookId))) {
    return bad('등록되지 않은 도서의 독서 회차가 있습니다.')
  }
  if (hasDuplicates(sessions.value.map((session) => `${session.bookId}#${session.round}`))) {
    return bad('같은 도서에 같은 회차가 중복되어 있습니다.')
  }
  for (const reward of rewards.value) {
    if (!bookIds.has(reward.bookId) || !sessionIds.has(reward.sessionId)) {
      return bad('존재하지 않는 도서나 회차를 가리키는 보상 이력이 있습니다.')
    }
    if (!hasBook(library, reward.libraryBookId)) {
      return bad('보상으로 지급된 도서가 도서관에 없습니다.')
    }
  }

  // 새 id가 기존 id와 겹치지 않으려면 일련번호가 저장된 id 번호보다 커야 한다.
  const used = [...books.value.map((b) => b.id), ...sessions.value.map((s) => s.id)]
  for (const id of used) {
    const match = /^(?:book|session)-(\d+)$/.exec(id)
    if (match && Number(match[1]) >= (nextSeq as number)) {
      return bad('저장된 일련번호가 이미 쓰인 id보다 작거나 같습니다.')
    }
  }

  return {
    ok: true,
    value: {
      books: books.value,
      sessions: sessions.value,
      rewards: rewards.value,
      nextSeq: nextSeq as number,
    },
  }
}

/**
 * 저장된 값을 검증해 게임 상태로 복원한다. 깨진 데이터는 예외 대신 실패 결과로 돌려준다.
 * 책장 용량이 저장 당시와 다를 때의 도서 배치는 `restoreLibrary`가 처리한다.
 */
export function restoreGame(raw: unknown, shelfCapacity: number): RestoreGameResult {
  if (!isRecord(raw)) return bad('저장 데이터가 객체가 아닙니다.')

  // v1: 도서관만 저장하던 형식. 독서 기록은 빈 상태로 시작한다.
  if (raw.version === LIBRARY_SNAPSHOT_VERSION) {
    const result = restoreLibrary(raw, shelfCapacity)
    return result.ok ? { ok: true, game: createGame(result.state) } : result
  }

  if (raw.version !== GAME_SNAPSHOT_VERSION) {
    return bad(`지원하지 않는 저장 데이터 버전입니다: ${String(raw.version)}`)
  }
  if (!isRecord(raw.library)) return bad('저장된 도서관이 객체가 아닙니다.')

  const library = restoreLibrary(
    { ...raw.library, version: LIBRARY_SNAPSHOT_VERSION },
    shelfCapacity,
  )
  if (!library.ok) return library

  const reading = parseReading(raw.reading, library.state)
  if (!reading.ok) return reading

  return { ok: true, game: { reading: reading.value, library: library.state } }
}
