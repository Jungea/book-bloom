import { GENRES } from '../reading/genres'
import {
  cancelFinish,
  deleteBook,
  finishReading,
  latestSession,
  startReading,
  type BookInput,
  type Game,
  type Outcome,
  type ReadingStatus,
} from '../reading/reading'

const STATUS_LABELS: Record<ReadingStatus, string> = {
  WANT: '읽고 싶음',
  READING: '읽는 중',
  PAUSED: '일시 중단',
  FINISHED: '완독',
  DROPPED: '하차',
}

/** 패널에 보여 줄 도서의 독서 상태. 기록이 없으면 "기록 없음". */
export function readingStatusLabel(game: Game, bookId: string): string {
  const latest = latestSession(game, bookId)
  if (!latest) return '기록 없음'
  return `${STATUS_LABELS[latest.status]} · ${latest.round}회차`
}

export interface ReadingAction {
  readonly label: string
  readonly run: (game: Game) => Outcome
}

/** 도서의 현재 독서 상태에서 실제 코어가 허용하는 동작을 패널 버튼으로 고른다. */
export function readingActions(game: Game, bookId: string): ReadingAction[] {
  const status = latestSession(game, bookId)?.status
  const actions: ReadingAction[] = []
  switch (status) {
    case undefined:
    case 'WANT':
      actions.push({ label: '시작', run: (g) => startReading(g, bookId) })
      break
    case 'READING':
      actions.push({ label: '완독', run: (g) => finishReading(g, bookId) })
      break
    case 'PAUSED':
    case 'DROPPED':
      actions.push({ label: '재개', run: (g) => startReading(g, bookId) })
      break
    case 'FINISHED':
      actions.push({ label: '재독 시작', run: (g) => startReading(g, bookId) })
      actions.push({ label: '완독 취소', run: (g) => cancelFinish(g, bookId) })
      break
  }
  actions.push({ label: '삭제', run: (g) => deleteBook(g, bookId) })
  return actions
}

/** 개발자 테스트용 등록 도서 입력. 번호가 겹치지 않도록 일련번호를 쓴다. */
export function testBookInput(game: Game): BookInput {
  return { title: `독서 테스트 ${game.reading.nextSeq}`, genre: GENRES[0] }
}
