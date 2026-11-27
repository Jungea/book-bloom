import { describe, expect, it } from 'vitest'
import {
  createVisitor,
  isWalking,
  routeBetween,
  stepVisitor,
  type Visitor,
  type VisitorConfig,
} from './visitors'

const config: VisitorConfig = {
  speed: 100, // 1000ms에 100px
  browseMs: 2000,
  checkoutMs: 1500,
  firstSpawnMs: 0,
  spawnIntervalMs: 5000,
  maxVisitors: 2,
  entrance: { x: 400, y: 500 },
  corridorY: 300,
  spots: [
    { x: 200, y: 260 },
    { x: 160, y: 270 },
  ],
  deskSlots: [
    { x: 80, y: 266 },
    { x: 114, y: 266 },
  ],
}

// 입장 경로: (400,500) → (400,300) 200px → (200,300) 200px → (200,260) 40px, 합계 440px = 4400ms
const ENTRY_MS = 4400

function advance(visitor: Visitor, dtMs: number): Visitor {
  const next = stepVisitor(visitor, dtMs, config)
  if (!next) throw new Error('이미 퇴장했습니다')
  return next
}

describe('routeBetween', () => {
  const corridorY = 300

  it('위로, 가로로, 위로 이동하는 직선 경로다', () => {
    expect(routeBetween({ x: 400, y: 500 }, { x: 200, y: 260 }, corridorY)).toEqual([
      { x: 400, y: 500 },
      { x: 400, y: 300 },
      { x: 200, y: 300 },
      { x: 200, y: 260 },
    ])
  })

  it('같은 가로줄이면 통로를 거치지 않고 곧바로 간다', () => {
    expect(routeBetween({ x: 114, y: 266 }, { x: 80, y: 266 }, corridorY)).toEqual([
      { x: 114, y: 266 },
      { x: 80, y: 266 },
    ])
  })

  it('이미 통로 위에 있으면 겹치는 점을 만들지 않는다', () => {
    expect(routeBetween({ x: 200, y: 300 }, { x: 80, y: 266 }, corridorY)).toEqual([
      { x: 200, y: 300 },
      { x: 80, y: 300 },
      { x: 80, y: 266 },
    ])
  })

  it('같은 지점이면 한 점뿐이다', () => {
    expect(routeBetween({ x: 5, y: 5 }, { x: 5, y: 5 }, corridorY)).toEqual([{ x: 5, y: 5 }])
  })

  it('모든 구간이 직선(가로 또는 세로)이다', () => {
    const route = routeBetween({ x: 123, y: 456 }, { x: 78, y: 90 }, corridorY)
    route.slice(1).forEach((point, i) => {
      expect(point.x === route[i].x || point.y === route[i].y).toBe(true)
    })
  })
})

describe('createVisitor', () => {
  it('없는 대기 지점은 거절한다', () => {
    expect(() => createVisitor('v', 5, config)).toThrow(RangeError)
  })
})

describe('stepVisitor: 입장과 구경', () => {
  it('입구 밖에서 시작해 속도만큼 위로 먼저 이동한다', () => {
    const start = createVisitor('v1', 0, config)
    expect(start.position).toEqual({ x: 400, y: 500 })
    expect(start.phase).toBe('ENTERING')

    const moved = advance(start, 1000)
    expect(moved.position).toEqual({ x: 400, y: 400 })
    expect(isWalking(moved)).toBe(true)
  })

  it('모퉁이를 돌 때 남은 거리를 이어서 가로로 이동한다', () => {
    const moved = advance(createVisitor('v1', 0, config), 2500) // 250px: 위로 200 후 왼쪽으로 50
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
    expect(waiting.browseLeftMs).toBe(1500)
  })

  it('구경이 끝나면 월드가 도서를 고르도록 판단을 요청하고 멈춘다', () => {
    const arrived = advance(createVisitor('v1', 0, config), ENTRY_MS)
    const done = advance(arrived, 2000)
    expect(done.pending).toBe('DECIDE')
    expect(done.phase).toBe('BROWSING')
    // 판단 전에는 시간이 더 흘러도 움직이지 않는다.
    expect(advance(done, 5000)).toEqual(done)
  })

  it('긴 시간을 한 번에 주어도 작게 나눠 진행한 결과와 같다', () => {
    const oneShot = stepVisitor(createVisitor('v1', 0, config), ENTRY_MS + 1000, config)
    let stepped: Visitor | null = createVisitor('v1', 0, config)
    for (let i = 0; i < 54 && stepped; i += 1) stepped = stepVisitor(stepped, 100, config)
    expect(oneShot?.phase).toBe('BROWSING')
    expect(stepped?.phase).toBe('BROWSING')
    expect(stepped?.browseLeftMs).toBeCloseTo(oneShot?.browseLeftMs ?? Number.NaN, 5)
  })

  it('시간이 0이면 그대로다', () => {
    const start = createVisitor('v1', 0, config)
    expect(stepVisitor(start, 0, config)).toEqual(start)
  })
})

describe('stepVisitor: 데스크와 퇴장', () => {
  /** 구경을 마치고 줄 0번으로 가는 손님. */
  function queuing(queueIndex: number): Visitor {
    const base = advance(createVisitor('v1', 0, config), ENTRY_MS)
    const target = config.deskSlots[queueIndex]
    return {
      ...base,
      spot: null,
      phase: 'QUEUING',
      route: routeBetween(base.position, target, config.corridorY),
      waypointIndex: 1,
      book: { loanId: 'loan-1', bookId: 'b1', started: false },
      queueIndex,
    }
  }

  it('서비스 지점(0번)에 도착하면 대출 처리를 시작한다', () => {
    const visitor = queuing(0)
    // (200,260) → (200,300) 40 → (80,300) 120 → (80,266) 34 = 194px
    const arrived = advance(visitor, 1940)
    expect(arrived.position).toEqual({ x: 80, y: 266 })
    expect(arrived.phase).toBe('CHECKOUT')
    expect(arrived.checkoutLeftMs).toBe(1500)
  })

  it('줄 뒤쪽 자리에 도착하면 그 자리에 서서 기다린다', () => {
    const visitor = queuing(1)
    const waiting = advance(visitor, 10_000)
    expect(waiting.phase).toBe('QUEUING')
    expect(waiting.position).toEqual({ x: 114, y: 266 })
    expect(isWalking(waiting)).toBe(false)
    expect(waiting.pending).toBeNull()
  })

  it('대출 처리가 끝나면 월드가 대출을 시작하도록 판단을 요청한다', () => {
    const arrived = advance(queuing(0), 1940)
    const done = advance(arrived, 1500)
    expect(done.pending).toBe('CHECKOUT_DONE')
  })

  it('퇴장 경로 끝에 도착하면 null을 돌려준다', () => {
    const leaving: Visitor = {
      ...createVisitor('v1', 0, config),
      phase: 'LEAVING',
      position: { x: 80, y: 266 },
      route: routeBetween({ x: 80, y: 266 }, config.entrance, config.corridorY),
      waypointIndex: 1,
    }
    // (80,266) → (80,300) 34 → (400,300) 320 → (400,500) 200 = 554px
    expect(stepVisitor(leaving, 5539, config)).not.toBeNull()
    expect(stepVisitor(leaving, 5540, config)).toBeNull()
  })
})
