import {
  createVisitor,
  stepVisitor,
  type Visitor,
  type VisitorConfig,
} from './visitors'

/** 탭을 오래 떠났다 돌아왔을 때 손님이 순간이동하지 않도록 한 번에 진행하는 시간의 상한. */
export const MAX_TICK_MS = 250

export interface VisitorWorld {
  getVisitors(): readonly Visitor[]
  /** 손님이 생기거나 퇴장하거나 비워질 때만 알린다. 매 프레임 이동은 알리지 않는다. */
  subscribe(listener: () => void): () => void
  /** 시간을 진행시킨다. 정해진 주기로 손님을 만들고, 퇴장한 손님은 지운다. */
  tick(dtMs: number): void
  /** 손님 1명을 즉시 만든다. 동시 인원이 가득 차 있으면 false. */
  spawn(): boolean
  clear(): void
}

/**
 * 손님들의 메모리 상태. 저장하지 않으며(v0.2), 시간은 tick을 부를 때만 흐른다.
 * 화면이 바뀌어 tick을 부르는 쪽이 사라지면 손님은 그 자리에서 멈춰 있다가 이어서 움직인다.
 */
export function createVisitorWorld(config: VisitorConfig): VisitorWorld {
  const limit = Math.min(config.maxVisitors, config.spots.length)
  let visitors: readonly Visitor[] = []
  let untilSpawnMs = config.firstSpawnMs
  let serial = 0
  const listeners = new Set<() => void>()

  const notify = () => {
    listeners.forEach((listener) => {
      try {
        listener()
      } catch (error) {
        console.error('손님 구독자 처리 중 오류가 발생했습니다.', error)
      }
    })
  }

  const freeSpot = (): number | null => {
    const used = new Set(visitors.map((visitor) => visitor.spot))
    for (let spot = 0; spot < limit; spot += 1) {
      if (!used.has(spot)) return spot
    }
    return null
  }

  const spawn = (): boolean => {
    const spot = freeSpot()
    if (spot === null) return false
    serial += 1
    visitors = [...visitors, createVisitor(`visitor-${serial}`, spot, config)]
    notify()
    return true
  }

  return {
    getVisitors: () => visitors,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    tick(dtMs) {
      const dt = Math.min(Math.max(dtMs, 0), MAX_TICK_MS)
      if (dt === 0) return

      const before = visitors.length
      const next: Visitor[] = []
      for (const visitor of visitors) {
        const moved = stepVisitor(visitor, dt, config)
        if (moved) next.push(moved)
      }
      visitors = next
      if (next.length !== before) notify()

      untilSpawnMs -= dt
      if (untilSpawnMs <= 0 && spawn()) untilSpawnMs = config.spawnIntervalMs
    },
    spawn,
    clear() {
      if (visitors.length === 0) return
      visitors = []
      untilSpawnMs = config.spawnIntervalMs
      notify()
    },
  }
}
