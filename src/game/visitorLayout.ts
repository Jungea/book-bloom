import type { VisitorConfig } from '../core/visitors'
import { FLOOR_Y, HEIGHT, SLOT_CENTERS } from './sceneLayout'

/** V4 visitor_idle.png(64×96)를 0.5배로 그린 논리 높이. */
export const VISITOR_HEIGHT = 48

const SHELF_X = SLOT_CENTERS[1]
const DESK_X = SLOT_CENTERS[0]
/** 데스크 앞에 서는 손님의 발 Y. 가구 기준선 아래라 가구 앞에 그려진다. */
const DESK_FRONT_Y = FLOOR_Y + 26

// 임시 상수: 방문 주기, 체류 시간, 동시 방문 인원, 이동 속도, 대출 처리 시간, 대출 기간은 기획에서 미정이다
// (docs/02 "추후 결정"). 이동·대출·반납 동작을 확인하기 위한 값이며 확정된 규칙이 아니다.
export const TEMP_VISITOR_SPEED = 60
export const TEMP_VISITOR_BROWSE_MS = 4000
export const TEMP_VISITOR_CHECKOUT_MS = 3000
export const TEMP_VISITOR_FIRST_SPAWN_MS = 1500
export const TEMP_VISITOR_SPAWN_INTERVAL_MS = 10_000
export const TEMP_VISITOR_MAX = 3
/** 대출 기간. 반납 트레이 누적을 눈으로 확인하기 쉽게 짧게 잡았다. */
export const TEMP_LOAN_DURATION_MS = 60_000

/**
 * 손님 경로. 입구는 화면 아래 바깥이라 화면 너비와 상관없이 가구 앞 바닥에서 올라온다.
 * 책장 앞 대기 지점은 책장 중심 앞 한 곳과 좌우 한 곳씩으로, 앞쪽 손님이 위에 그려진다.
 * 데스크 앞 지점은 0번이 서비스 지점이고 오른쪽으로 34px씩 줄 서는 자리다.
 */
export const VISITOR_CONFIG: VisitorConfig = {
  speed: TEMP_VISITOR_SPEED,
  browseMs: TEMP_VISITOR_BROWSE_MS,
  checkoutMs: TEMP_VISITOR_CHECKOUT_MS,
  firstSpawnMs: TEMP_VISITOR_FIRST_SPAWN_MS,
  spawnIntervalMs: TEMP_VISITOR_SPAWN_INTERVAL_MS,
  maxVisitors: TEMP_VISITOR_MAX,
  entrance: { x: 480, y: HEIGHT + VISITOR_HEIGHT + 8 },
  corridorY: FLOOR_Y + 60,
  spots: [
    { x: SHELF_X, y: FLOOR_Y + 24 },
    { x: SHELF_X - 34, y: FLOOR_Y + 34 },
    { x: SHELF_X + 34, y: FLOOR_Y + 34 },
  ],
  deskSlots: [
    { x: DESK_X, y: DESK_FRONT_Y },
    { x: DESK_X + 34, y: DESK_FRONT_Y },
    { x: DESK_X + 68, y: DESK_FRONT_Y },
  ],
}

/** 걷는 동안의 흔들림. 걷기 프레임이 없는 정지 이미지에 주는 임시 효과다. */
export function walkSway(timeMs: number, spot: number): { lift: number; angle: number } {
  const wave = Math.sin(timeMs / 110 + spot * 1.7)
  return { lift: Math.abs(wave) * 2, angle: wave * 3 }
}

/** 반납 도서 한 권을 정리하는 시간. 기획에서 미정이라 임시로 대출 처리 시간과 같게 잡았다. */
export const TEMP_SORT_MS = 3000
/** 정리된 책이 트레이에서 책장 원래 자리로 날아가는 시간. 시각 효과일 뿐 상태는 정리 시점에 바뀐다. */
export const TEMP_SORT_FLIGHT_MS = 500
