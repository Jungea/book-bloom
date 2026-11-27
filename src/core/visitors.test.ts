import { describe, expect, it } from 'vitest'
import {
  createVisitor,
  entryRoute,
  isWalking,
  stepVisitor,
  type Visitor,
  type VisitorConfig,
} from './visitors'

const config: VisitorConfig = {
  speed: 100, // 1000ms에 100px
  browseMs: 2000,
  firstSpawnMs: 0,
  spawnIntervalMs: 5000,
  maxVisitors: 2,
  entrance: { x: 400, y: 500 },
  corridorY: 300,
  spots: [
    { x: 200, y: 260 },
    { x: 160, y: 270 },
  ],
}

// 입장 경로: (400,500) → (400,300) 200px → (200,300) 200px → (200,260) 40px, 합계 440px = 4400ms
const ENTRY_MS = 4400

function advance(visitor: Visitor, dtMs: number): Visitor {
  const next = stepVisitor(visitor, dtMs, config)
  if (!next) throw new Error('이미 퇴장했습니다')
  return next
}

describe('entryRoute', () => {
  it('위로, 가로로, 위로 이동하는 직선 경로다', () => {
    expect(entryRoute(config, 0)).toEqual([
      { x: 400, y: 500 },
      { x: 400, y: 300 },
      { x: 200, y: 300 },
      { x: 200, y: 260 },
    ])
  })

  it('없는 대기 지점은 거절한다', () => {
    expect(() => entryRoute(config, 5)).toThrow(RangeError)
  })
})

describe('stepVisitor', () => {
  it('입구 밖에서 시작해 속도만큼 위로 먼저 이동한다', () => {
    const start = createVisitor('v1', 0, config)
    expect(start.position).toEqual({ x: 400, y: 500 })
    expect(start.phase).toBe('ENTERING')

    const moved = advance(start, 1000)
    expect(moved.position).toEqual({ x: 400, y: 400 })
    expect(isWalking(moved)).toBe(true)
  })

  it('모퉁이를 돌 때 남은 거리를 이어서 가로로 이동한다', () => {
    // 2500ms = 250px: 위로 200px 후 왼쪽으로 50px
    const moved = advance(createVisitor('v1', 0, config), 2500)
    expect(moved.position).toEqual({ x: 350, y: 300 })
  })

  it('책장 앞에 도착하면 구경을 시작하고 멈춘다', () => {
    const arrived = advance(createVisitor('v1', 0, config), ENTRY_MS)
    expect(arrived.phase).toBe('BROWSING')
    expect(arrived.position).toEqual({ x: 200, y: 260 })
    expect(arrived.browseLeftMs).toBe(2000)
    expect(isWalking(arrived)).toBe(false)

    const waiting = advance(arrived, 500)
    expect(waiting.phase).toBe('BROWSING')
    expect(waiting.position).toEqual({ x: 200, y: 260 })
    expect(waiting.browseLeftMs).toBe(1500)
  })

  it('구경이 끝나면 들어온 길을 거꾸로 걸어 나간다', () => {
    const arrived = advance(createVisitor('v1', 0, config), ENTRY_MS)
    const leaving = advance(arrived, 2000 + 400) // 구경 2000ms + 아래로 40px
    expect(leaving.phase).toBe('LEAVING')
    expect(leaving.position).toEqual({ x: 200, y: 300 })

    const further = advance(leaving, 1000)
    expect(further.position).toEqual({ x: 300, y: 300 })
  })

  it('퇴장을 마치면 null을 돌려준다', () => {
    const total = ENTRY_MS + 2000 + ENTRY_MS
    expect(stepVisitor(createVisitor('v1', 0, config), total - 1, config)).not.toBeNull()
    expect(stepVisitor(createVisitor('v1', 0, config), total, config)).toBeNull()
  })

  it('긴 시간을 한 번에 주어도 작게 나눠 진행한 결과와 같다', () => {
    const oneShot = stepVisitor(createVisitor('v1', 0, config), ENTRY_MS + 2000 + 1000, config)
    let stepped: Visitor | null = createVisitor('v1', 0, config)
    for (let i = 0; i < 74 && stepped; i += 1) stepped = stepVisitor(stepped, 100, config)
    // 100ms × 74 = 7400ms = ENTRY_MS + 2000 + 1000
    expect(oneShot?.phase).toBe('LEAVING')
    expect(stepped?.phase).toBe('LEAVING')
    expect(stepped?.position.x).toBeCloseTo(oneShot?.position.x ?? Number.NaN, 5)
    expect(stepped?.position.y).toBeCloseTo(oneShot?.position.y ?? Number.NaN, 5)
  })

  it('시간이 0이면 그대로다', () => {
    const start = createVisitor('v1', 0, config)
    expect(stepVisitor(start, 0, config)).toEqual(start)
  })
})
