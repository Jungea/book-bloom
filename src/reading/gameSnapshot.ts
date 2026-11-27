import { hasBook } from '../core/library'
import { restoreLibrary, SNAPSHOT_VERSION as LIBRARY_SNAPSHOT_VERSION } from '../core/librarySnapshot'
import {
  emptyCirculation,
  type Circulation,
  type LibraryBook,
  type LibraryState,
  type LoanRecord,
  type LoanStatus,
} from '../core/library'
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
export const GAME_SNAPSHOT_VERSION = 3

/**
 * 저장소에 넣는 게임 상태. 독서 기록과 도서관을 한 덩어리로 저장한다.
 * v1은 도서관만 저장하던 형식이며 `restoreGame`이 독서 기록이 빈 상태로 읽는다.
 * v2에는 대출 기록(`circulation`)이 없으며 빈 대출 기록으로 읽는다.
 */
export interface GameSnapshot {
  readonly version: typeof GAME_SNAPSHOT_VERSION
  readonly library: {
    readonly shelfCapacity: number
    readonly shelf: readonly (LibraryBook | null)[]
    readonly storage: readonly LibraryBook[]
    readonly circulation: Circulation
  }
  readonly reading: ReadingState
}

export type RestoreGameResult =
  | { readonly ok: true; readonly game: Game }
  | { readonly ok: false; readonly reason: string }

export function toGameSnapshot(game: Game): GameSnapshot {
  const { shelfCapacity, shelf, storage, circulation } = game.library
  return {
    version: GAME_SNAPSHOT_VERSION,
    library: { shelfCapacity, shelf, storage, circulation },
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

const LOAN_STATUSES: readonly LoanStatus[] = ['RESERVED', 'ON_LOAN', 'RETURNED', 'DONE']

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isTimeOrNull(value: unknown): value is number | null {
  return value === null || isTime(value)
}

function parseLoan(entry: unknown): LoanRecord | null {
  if (!isRecord(entry)) return null
  const { id, bookId, status, reservedAt, loanedAt, dueAt, returnedAt, doneAt, revokeOnReturn } = entry
  if (!isNonEmptyString(id) || !isNonEmptyString(bookId)) return null
  if (!LOAN_STATUSES.includes(status as LoanStatus)) return null
  if (!isTime(reservedAt) || !isTimeOrNull(loanedAt) || !isTimeOrNull(dueAt)) return null
  if (!isTimeOrNull(returnedAt) || !isTimeOrNull(doneAt) || typeof revokeOnReturn !== 'boolean') return null

  // 상태에 필요한 시각이 있는지 확인한다.
  const loan = status as LoanStatus
  if (loan === 'RESERVED') {
    if (loanedAt !== null || dueAt !== null || returnedAt !== null || doneAt !== null) return null
  } else if (loanedAt === null || dueAt === null) {
    return null
  }
  if (loan === 'ON_LOAN' && (returnedAt !== null || doneAt !== null)) return null
  if (loan === 'RETURNED' && (returnedAt === null || doneAt !== null)) return null
  if (loan === 'DONE' && doneAt === null) return null
  return { id, bookId, status: loan, reservedAt, loanedAt, dueAt, returnedAt, doneAt, revokeOnReturn }
}

/**
 * 저장된 대출 기록을 검증한다. 어긋난 값은 실패로 본다.
 * 책장 용량이 줄어 도서가 보관함으로 밀려난 경우에는 그 도서의 진행 중 기록만 버린다(임시 용량 변경 처리).
 */
function parseCirculation(raw: unknown, library: LibraryState): Parsed<Circulation> {
  if (!isRecord(raw)) return bad('대출 기록이 객체가 아닙니다.')
  const { nextSeq, returnQueue } = raw
  if (!Number.isInteger(nextSeq) || (nextSeq as number) < 1) return bad('다음 대출 번호가 올바르지 않습니다.')

  const parsed = parseArray(raw.loans, '대출 기록', parseLoan)
  if (!parsed.ok) return parsed
  const loans = parsed.value
  if (hasDuplicates(loans.map((loan) => loan.id))) return bad('같은 id의 대출 기록이 중복되어 있습니다.')
  for (const loan of loans) {
    const number = /^loan-(\d+)$/.exec(loan.id)?.[1]
    if (number !== undefined && Number(number) >= (nextSeq as number)) {
      return bad('다음 대출 번호가 기존 대출 기록 번호보다 작거나 같습니다.')
    }
  }

  const onShelf = new Set(library.shelf.flatMap((book) => (book ? [book.id] : [])))
  const inStorage = new Set(library.storage.map((book) => book.id))
  const kept: LoanRecord[] = []
  for (const loan of loans) {
    if (loan.status === 'DONE') {
      kept.push(loan)
      continue
    }
    if (!onShelf.has(loan.bookId)) {
      if (inStorage.has(loan.bookId)) continue // 용량 축소로 보관함에 밀려난 도서
      return bad('대출 기록이 도서관에 없는 도서를 가리킵니다.')
    }
    kept.push(loan)
  }
  const active = kept.filter((loan) => loan.status !== 'DONE')
  if (hasDuplicates(active.map((loan) => loan.bookId))) {
    return bad('한 도서에 진행 중인 대출 기록이 둘 이상입니다.')
  }

  if (!Array.isArray(returnQueue) || !returnQueue.every(isNonEmptyString)) {
    return bad('반납 대기열이 올바르지 않습니다.')
  }
  if (hasDuplicates(returnQueue as string[])) return bad('반납 대기열에 중복이 있습니다.')
  const returnedIds = new Set(kept.filter((loan) => loan.status === 'RETURNED').map((loan) => loan.id))
  const droppedIds = new Set(loans.filter((loan) => !kept.includes(loan)).map((loan) => loan.id))
  const queue = (returnQueue as string[]).filter((id) => !droppedIds.has(id))
  if (queue.length !== returnedIds.size || !queue.every((id) => returnedIds.has(id))) {
    return bad('반납 대기열이 반납 대기 중인 대출 기록과 맞지 않습니다.')
  }

  return { ok: true, value: { loans: kept, returnQueue: queue, nextSeq: nextSeq as number } }
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

  // v2: 대출 기록이 없던 형식. 빈 대출 기록으로 시작한다.
  if (raw.version !== GAME_SNAPSHOT_VERSION && raw.version !== 2) {
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

  let libraryState = library.state
  if (raw.version === GAME_SNAPSHOT_VERSION) {
    const circulation = parseCirculation(raw.library.circulation, libraryState)
    if (!circulation.ok) return circulation
    libraryState = { ...libraryState, circulation: circulation.value }
  } else {
    libraryState = { ...libraryState, circulation: emptyCirculation() }
  }

  return { ok: true, game: { reading: reading.value, library: libraryState } }
}
