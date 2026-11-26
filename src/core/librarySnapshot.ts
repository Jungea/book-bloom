import type { LibraryBook, LibraryState } from './library'

export const SNAPSHOT_VERSION = 1

/** 저장소에 넣는 도서관 상태. 구조를 바꾸면 SNAPSHOT_VERSION을 올리고 마이그레이션을 추가한다. */
export interface LibrarySnapshot {
  readonly version: typeof SNAPSHOT_VERSION
  readonly shelfCapacity: number
  readonly shelf: readonly (LibraryBook | null)[]
  readonly storage: readonly LibraryBook[]
}

export type RestoreResult =
  | { readonly ok: true; readonly state: LibraryState }
  | { readonly ok: false; readonly reason: string }

export function toSnapshot(state: LibraryState): LibrarySnapshot {
  return {
    version: SNAPSHOT_VERSION,
    shelfCapacity: state.shelfCapacity,
    shelf: state.shelf,
    storage: state.storage,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseBook(value: unknown): LibraryBook | null {
  if (!isRecord(value)) return null
  const { id, title } = value
  if (typeof id !== 'string' || id === '' || typeof title !== 'string') return null
  return { id, title }
}

/**
 * 저장된 값을 검증해 도서관 상태로 복원한다. 깨진 데이터는 예외 대신 실패 결과로 돌려준다.
 *
 * 저장 당시 책장 용량과 현재 용량이 다르면 도서 위치를 유지한 채 맞춘다.
 * - 줄어들면 넘치는 도서는 보관함 앞쪽으로 옮긴다(보관함 도서보다 먼저 획득했으므로).
 * - 늘어나면 보관함 도서를 획득 순서대로 앞쪽 빈 슬롯에 채운다.
 * 이 용량 변경 처리는 임시 용량(TEMP_SHELF_CAPACITY)이 바뀔 때를 위한 것이며 확정된 기획 규칙이 아니다.
 */
export function restoreLibrary(raw: unknown, shelfCapacity: number): RestoreResult {
  if (!isRecord(raw)) return { ok: false, reason: '저장 데이터가 객체가 아닙니다.' }
  if (raw.version !== SNAPSHOT_VERSION) {
    return { ok: false, reason: `지원하지 않는 저장 데이터 버전입니다: ${String(raw.version)}` }
  }

  const { shelf: rawShelf, storage: rawStorage, shelfCapacity: savedCapacity } = raw
  if (!Number.isInteger(savedCapacity) || (savedCapacity as number) < 0) {
    return { ok: false, reason: '저장된 책장 용량이 올바르지 않습니다.' }
  }
  if (!Array.isArray(rawShelf) || rawShelf.length !== savedCapacity) {
    return { ok: false, reason: '저장된 책장 슬롯 수가 용량과 맞지 않습니다.' }
  }
  if (!Array.isArray(rawStorage)) return { ok: false, reason: '저장된 보관함이 배열이 아닙니다.' }

  const savedShelf: (LibraryBook | null)[] = []
  for (const entry of rawShelf) {
    if (entry === null) {
      savedShelf.push(null)
      continue
    }
    const book = parseBook(entry)
    if (!book) return { ok: false, reason: '책장에 올바르지 않은 도서가 있습니다.' }
    savedShelf.push(book)
  }

  const savedStorage: LibraryBook[] = []
  for (const entry of rawStorage) {
    const book = parseBook(entry)
    if (!book) return { ok: false, reason: '보관함에 올바르지 않은 도서가 있습니다.' }
    savedStorage.push(book)
  }

  const ids = [...savedShelf, ...savedStorage].filter((b): b is LibraryBook => b !== null)
  if (new Set(ids.map((book) => book.id)).size !== ids.length) {
    return { ok: false, reason: '같은 id의 도서가 중복 저장되어 있습니다.' }
  }

  const shelf: (LibraryBook | null)[] = Array.from(
    { length: shelfCapacity },
    (_, slot) => savedShelf[slot] ?? null,
  )
  const overflow = savedShelf.slice(shelfCapacity).filter((b): b is LibraryBook => b !== null)
  const waiting = [...overflow, ...savedStorage]

  let next = 0
  for (let slot = 0; slot < shelf.length && next < waiting.length; slot += 1) {
    if (shelf[slot] === null) {
      shelf[slot] = waiting[next]
      next += 1
    }
  }

  return { ok: true, state: { shelfCapacity, shelf, storage: waiting.slice(next) } }
}
