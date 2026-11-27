import type { VisitorConfig } from '../core/visitors'
import { FLOOR_Y, HEIGHT, SLOT_CENTERS } from './sceneLayout'

/** V4 visitor_idle.png(64×96)를 0.5배로 그린 논리 높이. */
export const VISITOR_HEIGHT = 48

const SHELF_X = SLOT_CENTERS[1]

// 임시 상수: 방문 주기, 체류 시간, 동시 방문 인원, 이동 속도는 기획에서 미정이다(docs/02 "추후 결정").
// v0.2에서 이동·대기·퇴장 동작을 확인하기 위한 값이며 확정된 규칙이 아니다.
export const TEMP_VISITOR_SPEED = 60
export const TEMP_VISITOR_BROWSE_MS = 4000
export const TEMP_VISITOR_FIRST_SPAWN_MS = 1500
export const TEMP_VISITOR_SPAWN_INTERVAL_MS = 10_000
export const TEMP_VISITOR_MAX = 3

/**
 * 손님 경로. 입구는 화면 아래 바깥이라 화면 너비와 상관없이 가구 앞 바닥에서 올라온다.
 * 책장 앞 대기 지점은 책장 중심 앞 한 곳과 좌우 한 곳씩으로, 앞쪽 손님이 위에 그려진다.
 */
export const VISITOR_CONFIG: VisitorConfig = {
  speed: TEMP_VISITOR_SPEED,
  browseMs: TEMP_VISITOR_BROWSE_MS,
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
}

/** 걷는 동안의 흔들림. 걷기 프레임이 없는 정지 이미지에 주는 임시 효과다. */
export function walkSway(timeMs: number, spot: number): { lift: number; angle: number } {
  const wave = Math.sin(timeMs / 110 + spot * 1.7)
  return { lift: Math.abs(wave) * 2, angle: wave * 3 }
}
