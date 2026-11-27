// v0.2 손님: 입장 → 책장 앞으로 이동 → 구경(대기) → 퇴장. 대출·반납은 v0.3 범위라 하지 않는다.
// Phaser와 무관한 순수 계산이며 좌표는 논리 좌표(640×360 기준)다.

export interface Point {
  readonly x: number
  readonly y: number
}

export type VisitorPhase = 'ENTERING' | 'BROWSING' | 'LEAVING'

export interface Visitor {
  readonly id: string
  /** 책장 앞 대기 지점 번호. 손님끼리 겹치지 않게 하나씩 배정한다. */
  readonly spot: number
  readonly phase: VisitorPhase
  readonly position: Point
  /** 현재 단계의 경로에서 지금 향하는 점의 번호. */
  readonly waypointIndex: number
  readonly browseLeftMs: number
}

export interface VisitorConfig {
  /** 이동 속도. 논리 픽셀/초. */
  readonly speed: number
  /** 책장 앞에서 구경하는 시간. */
  readonly browseMs: number
  /** 첫 손님이 나타나기까지의 시간. */
  readonly firstSpawnMs: number
  /** 이후 손님이 나타나는 주기. */
  readonly spawnIntervalMs: number
  readonly maxVisitors: number
  /** 입장·퇴장 지점(화면 밖). */
  readonly entrance: Point
  /** 가로로 이동하는 통로의 Y. */
  readonly corridorY: number
  /** 책장 앞 대기 지점들. 개수가 동시 구경 인원의 상한이다. */
  readonly spots: readonly Point[]
}

/** 입장 경로: 입구에서 위로, 통로에서 가로로, 책장 앞까지 위로. 직선 구간만 쓴다(길찾기 없음). */
export function entryRoute(config: VisitorConfig, spotIndex: number): readonly Point[] {
  const spot = config.spots[spotIndex]
  if (!spot) throw new RangeError(`없는 대기 지점입니다: ${spotIndex}`)
  return [
    config.entrance,
    { x: config.entrance.x, y: config.corridorY },
    { x: spot.x, y: config.corridorY },
    spot,
  ]
}

function exitRoute(config: VisitorConfig, spotIndex: number): readonly Point[] {
  return entryRoute(config, spotIndex).slice().reverse()
}

export function createVisitor(id: string, spotIndex: number, config: VisitorConfig): Visitor {
  const route = entryRoute(config, spotIndex)
  return {
    id,
    spot: spotIndex,
    phase: 'ENTERING',
    position: route[0],
    waypointIndex: 1,
    browseLeftMs: 0,
  }
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * 손님을 dtMs만큼 진행시킨다. 퇴장을 마치면 null을 돌려준다.
 * 긴 시간이 한 번에 주어져도 단계를 차례로 넘어가며 남은 시간을 이어서 쓴다.
 */
export function stepVisitor(visitor: Visitor, dtMs: number, config: VisitorConfig): Visitor | null {
  let current = visitor
  let leftMs = dtMs

  while (leftMs > 0) {
    if (current.phase === 'BROWSING') {
      const used = Math.min(leftMs, current.browseLeftMs)
      leftMs -= used
      const rest = current.browseLeftMs - used
      if (rest > 0) return { ...current, browseLeftMs: rest }
      current = { ...current, phase: 'LEAVING', browseLeftMs: 0, waypointIndex: 1 }
      continue
    }

    const route =
      current.phase === 'ENTERING' ? entryRoute(config, current.spot) : exitRoute(config, current.spot)
    let budget = (config.speed * leftMs) / 1000
    let position = current.position
    let index = current.waypointIndex

    while (budget > 0 && index < route.length) {
      const target = route[index]
      const gap = distance(position, target)
      if (gap <= budget) {
        position = target
        budget -= gap
        index += 1
      } else {
        const ratio = budget / gap
        position = {
          x: position.x + (target.x - position.x) * ratio,
          y: position.y + (target.y - position.y) * ratio,
        }
        budget = 0
      }
    }

    if (index < route.length) return { ...current, position, waypointIndex: index }

    // 경로 끝에 도착했다. 남은 이동 거리를 시간으로 되돌려 다음 단계에 쓴다.
    leftMs = (budget * 1000) / config.speed
    if (current.phase === 'LEAVING') return null
    current = {
      ...current,
      phase: 'BROWSING',
      position,
      waypointIndex: 0,
      browseLeftMs: config.browseMs,
    }
  }
  return current
}

/** 걷는 중인지(이동 단계인지). 렌더링의 흔들림 효과에 쓴다. */
export function isWalking(visitor: Visitor): boolean {
  return visitor.phase !== 'BROWSING'
}
