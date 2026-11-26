import { createLibrary } from '../core/library'
import { restoreGame } from '../reading/gameSnapshot'
import { createGame, type Game } from '../reading/reading'
import type { GameStorage } from './gameStorage'

export interface LoadedGame {
  readonly game: Game
  /** 사용자에게 알릴 문제. 없으면 null. */
  readonly notice: string | null
}

/**
 * 저장된 게임(독서 기록과 도서관)을 불러온다. 어떤 실패도 앱을 멈추지 않고 빈 상태로 시작하게 한다.
 * 복원하지 못한 데이터는 다음 저장이 덮어쓰기 전에 따로 보관한다.
 */
export async function loadGame(storage: GameStorage, shelfCapacity: number): Promise<LoadedGame> {
  const empty = createGame(createLibrary(shelfCapacity))

  let raw: unknown
  try {
    raw = await storage.load()
  } catch (error) {
    console.error('저장된 데이터를 불러오지 못했습니다.', error)
    return { game: empty, notice: '저장된 데이터를 불러오지 못했습니다. 이번 실행은 빈 상태로 시작합니다.' }
  }
  if (raw === null) return { game: empty, notice: null }

  const result = restoreGame(raw, shelfCapacity)
  if (result.ok) return { game: result.game, notice: null }

  console.error('저장 데이터를 복원하지 못했습니다.', result.reason, raw)
  try {
    await storage.quarantine(raw)
  } catch (error) {
    console.error('복원하지 못한 저장 데이터를 따로 보관하지 못했습니다.', error)
    return {
      game: empty,
      notice: `저장 데이터가 올바르지 않고(${result.reason}) 원본도 보관하지 못했습니다.`,
    }
  }
  return {
    game: empty,
    notice: `저장 데이터가 올바르지 않아(${result.reason}) 빈 상태로 시작합니다. 원본은 따로 보관했습니다.`,
  }
}
