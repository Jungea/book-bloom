import { shelvedCount } from '../core/library'
import {
  addToWishlist,
  cancelFinish,
  deleteBook,
  dropReading,
  finishReading,
  latestSession,
  pauseReading,
  startReading,
  type Game,
  type Outcome,
  type ReadingStatus,
} from './reading'

// 독서관리 화면과 개발자 패널이 함께 쓰는 표시·동작 선택 로직. 화면 코드와 분리해 테스트한다.

const STATUS_LABELS: Record<ReadingStatus, string> = {
  WANT: '읽고 싶음',
  READING: '읽는 중',
  PAUSED: '일시 중단',
  FINISHED: '완독',
  DROPPED: '하차',
}

/** 도서의 현재 독서 상태. 기록이 없으면 "기록 없음". */
export function readingStatusLabel(game: Game, bookId: string): string {
  const latest = latestSession(game, bookId)
  if (!latest) return '기록 없음'
  return `${STATUS_LABELS[latest.status]} · ${latest.round}회차`
}

export interface BookAction {
  readonly label: string
  readonly run: (game: Game) => Outcome
  /** 되돌리기 어려운 동작. 화면에서 강조하고 확인을 받는다. */
  readonly danger?: boolean
  /** 실행 전에 사용자에게 확인받을 문구. */
  readonly confirm?: string
}

/** 도서의 현재 독서 상태에서 코어가 허용하는 동작. 삭제는 항상 마지막에 있다. */
export function bookActions(game: Game, bookId: string): BookAction[] {
  const status = latestSession(game, bookId)?.status
  const actions: BookAction[] = []
  switch (status) {
    case undefined:
      actions.push({ label: '읽고 싶음', run: (g) => addToWishlist(g, bookId) })
      actions.push({ label: '시작', run: (g) => startReading(g, bookId) })
      break
    case 'WANT':
      actions.push({ label: '시작', run: (g) => startReading(g, bookId) })
      break
    case 'READING':
      actions.push({ label: '완독', run: (g) => finishReading(g, bookId) })
      actions.push({ label: '일시 중단', run: (g) => pauseReading(g, bookId) })
      actions.push({ label: '하차', run: (g) => dropReading(g, bookId) })
      break
    case 'PAUSED':
      actions.push({ label: '재개', run: (g) => startReading(g, bookId) })
      actions.push({ label: '하차', run: (g) => dropReading(g, bookId) })
      break
    case 'DROPPED':
      actions.push({ label: '재개', run: (g) => startReading(g, bookId) })
      break
    case 'FINISHED':
      actions.push({ label: '재독 시작', run: (g) => startReading(g, bookId) })
      actions.push({
        label: '완독 취소',
        run: (g) => cancelFinish(g, bookId),
        confirm: '완독을 취소하면 그 회차의 완독으로 받은 게임 도서 1권이 회수됩니다. 계속할까요?',
      })
      break
  }

  const granted = game.reading.rewards.filter((reward) => reward.bookId === bookId).length
  actions.push({
    label: '삭제',
    run: (g) => deleteBook(g, bookId),
    danger: true,
    confirm:
      granted > 0
        ? `도서와 독서 기록을 삭제하면 받은 게임 도서 ${granted}권도 함께 회수됩니다. 계속할까요?`
        : '도서와 독서 기록을 삭제합니다. 계속할까요?',
  })
  return actions
}

/** 도서관에 있는 도서 수(책장 + 보관함). */
export function libraryBookCount(game: Game): number {
  return shelvedCount(game.library) + game.library.storage.length
}

/** 동작 전후 도서관 도서 수의 변화를 사용자에게 보여 줄 문구로 만든다. 변화가 없으면 null. */
export function rewardMessage(before: Game, after: Game): string | null {
  const delta = libraryBookCount(after) - libraryBookCount(before)
  if (delta === 0) return null
  return `도서관 도서 ${delta > 0 ? '+' : ''}${delta}권`
}
