import { createLibrary } from '../core/library'
import { restoreGame } from '../reading/gameSnapshot'
import { createGame, type Game } from '../reading/reading'
import type { GameStorage } from './gameStorage'

/**
 * 불러오기 결과. 기존 저장 데이터를 확인하지도, 따로 보관하지도 못했다면 게임을 시작하지 않는다.
 * 그 상태로 시작하면 다음 저장이 기존 데이터를 빈 상태로 덮어쓰기 때문이다. 실패에는 game이 없어 조작할 수 없다.
 */
export type LoadedGame =
  | {
      readonly ok: true
      readonly game: Game
      /** 사용자에게 알릴 문제. 없으면 null. */
      readonly notice: string | null
    }
  | {
      readonly ok: false
      /** 오류 화면에 보여 줄 안내. */
      readonly message: string
    }

const PROTECT_AND_RESTART = '기존 데이터 보호를 위해 변경을 중단했습니다. 앱을 다시 시작해 주세요.'

/**
 * 저장된 게임(독서 기록과 도서관)을 불러온다.
 * 저장된 데이터가 없으면 빈 상태로, 복원하지 못한 데이터는 따로 보관한 뒤 빈 상태로 시작한다.
 * 불러오기에 실패했거나 복원하지 못한 데이터를 보관하지 못하면 시작하지 않고 실패(ok: false)를 돌려준다.
 */
export async function loadGame(storage: GameStorage, shelfCapacity: number): Promise<LoadedGame> {
  const empty = createGame(createLibrary(shelfCapacity))

  let raw: unknown
  try {
    raw = await storage.load()
  } catch (error) {
    console.error('저장된 데이터를 불러오지 못했습니다.', error)
    return { ok: false, message: `저장된 데이터를 불러오지 못했습니다. ${PROTECT_AND_RESTART}` }
  }
  if (raw === null) return { ok: true, game: empty, notice: null }

  const result = restoreGame(raw, shelfCapacity)
  if (result.ok) return { ok: true, game: result.game, notice: null }

  console.error('저장 데이터를 복원하지 못했습니다.', result.reason, raw)
  try {
    await storage.quarantine(raw)
  } catch (error) {
    console.error('복원하지 못한 저장 데이터를 따로 보관하지 못했습니다.', error)
    return {
      ok: false,
      message: `저장 데이터가 올바르지 않고(${result.reason}) 원본도 보관하지 못했습니다. ${PROTECT_AND_RESTART}`,
    }
  }
  return {
    ok: true,
    game: empty,
    notice: `저장 데이터가 올바르지 않아(${result.reason}) 빈 상태로 시작합니다. 원본은 따로 보관했습니다.`,
  }
}
