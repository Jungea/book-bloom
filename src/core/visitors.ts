// v0.2~v0.3 손님: 입장 → 책장 앞 구경 → (도서를 골랐다면) 데스크 줄 → 대출 처리 → 퇴장.
// Phaser와 무관한 순수 계산이며 좌표는 논리 좌표(640×360 기준)다. 도서관 상태(예약·대출)는 모르고,
// 구경이 끝나는 시점과 대출 처리가 끝나는 시점에 `pending`으로 월드에 판단을 맡긴다.

export interface Point {
  readonly x: number
  readonly y: number
}

export type VisitorPhase = 'ENTERING' | 'BROWSING' | 'QUEUING' | 'CHECKOUT' | 'LEAVING'

/** 월드가 처리해야 하는 판단. 구경이 끝나면 도서 선택, 대출 처리가 끝나면 대출 시작. */
export type VisitorPending = 'DECIDE' | 'CHECKOUT_DONE'

export interface CarriedBook {
  readonly loanId: string
  readonly bookId: string
  /** 대출 처리가 끝나 대출이 시작됐는지. false면 예약만 된 상태다. */
  readonly started: boolean
}

export interface Visitor {
  readonly id: string
  /** 책장 앞 대기 지점 번호. 입장·구경 중에만 갖고 구경이 끝나면 반납한다. */
  readonly spot: number | null
  readonly phase: VisitorPhase
  readonly position: Point
  /** 이동 경로. waypointIndex가 경로 길이 이상이면 서 있는 상태다. */
  readonly route: readonly Point[]
  readonly waypointIndex: number
  readonly browseLeftMs: number
  readonly checkoutLeftMs: number
  readonly book: CarriedBook | null
  /** 데스크 줄에서의 순번. 0이 서비스 지점이다. */
  readonly queueIndex: number | null
  readonly pending: VisitorPending | null
}

export interface VisitorConfig {
  /** 이동 속도. 논리 픽셀/초. */
  readonly speed: number
  /** 책장 앞에서 구경하는 시간. */
  readonly browseMs: number
  /** 데스크에서 대출을 처리하는 시간. */
  readonly checkoutMs: number
  /** 첫 손님이 나타나기까지의 시간. */
  readonly firstSpawnMs: number
  /** 이후 손님이 나타나는 주기. */
  readonly spawnIntervalMs: number
  readonly maxVisitors: number
  /** 입장·퇴장 지점(화면 밖). */
  readonly entrance: Point
  /** 가로로 이동하는 통로의 Y. */
  readonly corridorY: number
  /** 책장 앞 대기 지점들. */
  readonly spots: readonly Point[]
  /** 데스크 앞 지점들. 0번이 서비스 지점이고 나머지는 줄 서는 자리다. */
  readonly deskSlots: readonly Point[]
}

function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y
}

/**
 * 두 지점을 잇는 직선 구간 경로. 같은 가로줄·세로줄이면 곧바로 가고, 아니면 통로를 거친다
 * (세로로 통로까지, 통로를 따라 가로로, 세로로 목적지까지). 길찾기는 없다.
 */
export function routeBetween(from: Point, to: Point, corridorY: number): readonly Point[] {
  const candidates: Point[] =
    from.x === to.x || from.y === to.y
      ? [from, to]
      : [from, { x: from.x, y: corridorY }, { x: to.x, y: corridorY }, to]
  return candidates.filter((point, i) => i === 0 || !samePoint(point, candidates[i - 1]))
}

export function createVisitor(id: string, spotIndex: number, config: VisitorConfig): Visitor {
  const spot = config.spots[spotIndex]
  if (!spot) throw new RangeError(`없는 대기 지점입니다: ${spotIndex}`)
  const route = routeBetween(config.entrance, spot, config.corridorY)
  return {
    id,
    spot: spotIndex,
    phase: 'ENTERING',
    position: route[0],
    route,
    waypointIndex: 1,
    browseLeftMs: 0,
    checkoutLeftMs: 0,
    book: null,
    queueIndex: null,
    pending: null,
  }
}

/** 걷는 중인지(이동할 경로가 남았는지). 렌더링의 흔들림 효과에 쓴다. */
export function isWalking(visitor: Visitor): boolean {
  return visitor.waypointIndex < visitor.route.length
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** 경로를 따라 이동한다. 남은 시간(경로를 다 가고 남은 만큼)을 함께 돌려준다. */
function moveAlong(visitor: Visitor, ms: number, speed: number): { visitor: Visitor; leftMs: number } {
  let budget = (speed * ms) / 1000
  let position = visitor.position
  let index = visitor.waypointIndex

  while (budget > 0 && index < visitor.route.length) {
    const target = visitor.route[index]
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
  const arrived = index >= visitor.route.length
  return {
    visitor: { ...visitor, position, waypointIndex: index },
    leftMs: arrived ? (budget * 1000) / speed : 0,
  }
}

/** 경로 끝에 도착했을 때의 다음 단계. 퇴장을 마쳤으면 null. */
function arrive(visitor: Visitor, config: VisitorConfig): Visitor | null {
  switch (visitor.phase) {
    case 'ENTERING':
      return { ...visitor, phase: 'BROWSING', route: [], waypointIndex: 0, browseLeftMs: config.browseMs }
    case 'QUEUING':
      // 서비스 지점에 도착하면 대출 처리를 시작한다. 줄 뒤쪽이면 그 자리에 서서 기다린다.
      return visitor.queueIndex === 0
        ? { ...visitor, phase: 'CHECKOUT', checkoutLeftMs: config.checkoutMs }
        : visitor
    case 'LEAVING':
      return null
    default:
      return visitor
  }
}

/**
 * 손님을 dtMs만큼 진행시킨다. 퇴장을 마치면 null을 돌려준다.
 * 긴 시간이 한 번에 주어져도 단계를 차례로 넘어가며 남은 시간을 이어서 쓴다.
 * 구경·대출 처리 시간이 끝나면 `pending`을 달아 멈추며, 이어지는 동작은 월드가 정한다.
 */
export function stepVisitor(visitor: Visitor, dtMs: number, config: VisitorConfig): Visitor | null {
  let current = visitor
  let leftMs = dtMs

  for (let guard = 0; guard < 16; guard += 1) {
    if (current.pending) return current

    if (current.phase === 'BROWSING') {
      const used = Math.min(leftMs, current.browseLeftMs)
      const rest = current.browseLeftMs - used
      if (rest > 0) return { ...current, browseLeftMs: rest }
      return { ...current, browseLeftMs: 0, pending: 'DECIDE' }
    }

    if (current.phase === 'CHECKOUT') {
      const used = Math.min(leftMs, current.checkoutLeftMs)
      const rest = current.checkoutLeftMs - used
      if (rest > 0) return { ...current, checkoutLeftMs: rest }
      return { ...current, checkoutLeftMs: 0, pending: 'CHECKOUT_DONE' }
    }

    // 이동하는 단계: ENTERING, QUEUING, LEAVING
    const moved = moveAlong(current, leftMs, config.speed)
    current = moved.visitor
    leftMs = moved.leftMs
    if (current.waypointIndex < current.route.length) return current // 아직 가는 중

    const arrived = arrive(current, config)
    if (arrived === null) return null
    if (arrived.phase === current.phase) return arrived // 줄에 서서 기다리는 중
    current = arrived
  }
  return current
}
