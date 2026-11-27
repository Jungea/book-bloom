import {
  createVisitor,
  routeBetween,
  stepVisitor,
  type Visitor,
  type VisitorConfig,
} from './visitors'

/** 탭을 오래 떠났다 돌아왔을 때 손님이 순간이동하지 않도록 한 번에 진행하는 시간의 상한. */
export const MAX_TICK_MS = 250

export type ReserveResult =
  | { readonly ok: true; readonly loanId: string; readonly bookId: string }
  | { readonly ok: false; readonly reason: string }

export type HookResult = { readonly ok: true } | { readonly ok: false; readonly reason: string }

/**
 * 손님 월드가 도서관 상태와 만나는 지점. 월드는 도서관 상태를 직접 알지 못하고 이 훅만 부른다.
 * 모든 훅은 성공·실패를 돌려주며 예외를 던지지 않는다. 실패해도 손님은 줄을 막지 않고 퇴장한다.
 */
export interface VisitorHooks {
  /** 구경을 마친 손님이 대출할 도서를 고른다. 즉시 예약한다. 고를 도서가 없으면 실패. */
  reserve(): ReserveResult
  /** 대출 처리를 마친다. 예약이 사라졌거나 도서가 회수된 경우 등에는 실패. */
  startLoan(loanId: string): HookResult
  /** 예약을 해제한다. */
  cancel(loanId: string): void
}

/** 도서를 고르지 않는 훅(v0.2 동작): 구경만 하고 퇴장한다. */
export const NO_CIRCULATION: VisitorHooks = {
  reserve: () => ({ ok: false, reason: '대출을 연결하지 않았습니다.' }),
  startLoan: () => ({ ok: false, reason: '대출을 연결하지 않았습니다.' }),
  cancel: () => {},
}

export interface VisitorWorld {
  getVisitors(): readonly Visitor[]
  /** 데스크 줄의 손님 id. 앞쪽(0번)이 서비스 지점이다. */
  getDeskQueue(): readonly string[]
  /** 손님이 생기거나 퇴장하거나 줄·단계가 바뀔 때만 알린다. 매 프레임 이동은 알리지 않는다. */
  subscribe(listener: () => void): () => void
  /** 시간을 진행시킨다. 정해진 주기로 손님을 만들고, 퇴장한 손님은 지운다. */
  tick(dtMs: number): void
  /** 손님 1명을 즉시 만든다. 동시 인원이 가득 차 있으면 false. */
  spawn(): boolean
  /** 서비스 지점에서 처리 중인 대출을 즉시 완료한다. 처리 중인 손님이 없으면 false. */
  completeCheckout(): boolean
  /** 모든 손님을 지운다. 예약만 된 도서는 예약을 해제한다. */
  clear(): void
}

/**
 * 손님들의 메모리 상태. 저장하지 않으며, 시간은 tick을 부를 때만 흐른다.
 * 화면이 바뀌어 tick을 부르는 쪽이 사라지면 손님은 그 자리에서 멈춰 있다가 이어서 움직인다.
 */
export function createVisitorWorld(
  config: VisitorConfig,
  hooks: VisitorHooks = NO_CIRCULATION,
): VisitorWorld {
  const spotLimit = Math.min(config.maxVisitors, config.spots.length)
  let visitors: readonly Visitor[] = []
  let deskQueue: readonly string[] = []
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

  const update = (next: Visitor) => {
    visitors = visitors.map((visitor) => (visitor.id === next.id ? next : visitor))
  }

  const freeSpot = (): number | null => {
    const used = new Set(visitors.flatMap((visitor) => (visitor.spot === null ? [] : [visitor.spot])))
    for (let spot = 0; spot < spotLimit; spot += 1) {
      if (!used.has(spot)) return spot
    }
    return null
  }

  const leave = (visitor: Visitor, book: Visitor['book']): Visitor => ({
    ...visitor,
    spot: null,
    phase: 'LEAVING',
    route: routeBetween(visitor.position, config.entrance, config.corridorY),
    waypointIndex: 1,
    book,
    queueIndex: null,
    pending: null,
  })

  /** 구경을 마친 손님: 도서를 골라 데스크 줄에 서거나, 고를 도서가 없으면 대출 없이 퇴장한다. */
  const decide = (visitor: Visitor): Visitor => {
    if (deskQueue.length >= config.deskSlots.length) return leave(visitor, null)
    const reserved = hooks.reserve()
    if (!reserved.ok) return leave(visitor, null)

    const index = deskQueue.length
    deskQueue = [...deskQueue, visitor.id]
    return {
      ...visitor,
      spot: null,
      phase: 'QUEUING',
      route: routeBetween(visitor.position, config.deskSlots[index], config.corridorY),
      waypointIndex: 1,
      book: { loanId: reserved.loanId, bookId: reserved.bookId, started: false },
      queueIndex: index,
      pending: null,
    }
  }

  /** 대출 처리를 마친 손님: 대출을 시작하고 퇴장한다. 실패해도 줄을 비우고 퇴장한다(예약은 해제). */
  const finishCheckout = (visitor: Visitor): Visitor => {
    deskQueue = deskQueue.filter((id) => id !== visitor.id)
    const book = visitor.book
    if (!book) return leave(visitor, null)
    const started = hooks.startLoan(book.loanId)
    if (started.ok) return leave(visitor, { ...book, started: true })
    hooks.cancel(book.loanId)
    return leave(visitor, null)
  }

  /** 월드가 판단해야 하는 손님을 처리한다. 처리한 손님이 있으면 true. */
  const resolvePending = (): boolean => {
    let changed = false
    for (const visitor of visitors) {
      if (visitor.pending === 'DECIDE') {
        update(decide(visitor))
        changed = true
      } else if (visitor.pending === 'CHECKOUT_DONE') {
        update(finishCheckout(visitor))
        changed = true
      }
    }
    return changed
  }

  /** 앞 손님이 줄을 떠나면 뒤 손님이 한 칸씩 앞으로 나온다. */
  const advanceQueue = (): boolean => {
    let changed = false
    deskQueue.forEach((id, index) => {
      const visitor = visitors.find((other) => other.id === id)
      if (!visitor || visitor.queueIndex === index) return
      update({
        ...visitor,
        queueIndex: index,
        route: routeBetween(visitor.position, config.deskSlots[index], config.corridorY),
        waypointIndex: 1,
      })
      changed = true
    })
    return changed
  }

  const spawn = (): boolean => {
    if (visitors.length >= config.maxVisitors) return false
    const spot = freeSpot()
    if (spot === null) return false
    serial += 1
    visitors = [...visitors, createVisitor(`visitor-${serial}`, spot, config)]
    notify()
    return true
  }

  return {
    getVisitors: () => visitors,
    getDeskQueue: () => deskQueue,
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

      // 판단 결과로 줄이 바뀌고, 줄이 바뀌면 뒤 손님이 전진하므로 변화가 없을 때까지 반복한다.
      let changed = visitors.length !== before
      for (let i = 0; i < 8; i += 1) {
        const resolved = resolvePending()
        const advanced = advanceQueue()
        changed = changed || resolved || advanced
        if (!resolved && !advanced) break
      }
      if (changed) notify()

      untilSpawnMs -= dt
      if (untilSpawnMs <= 0 && spawn()) untilSpawnMs = config.spawnIntervalMs
    },
    spawn,
    completeCheckout() {
      const front = visitors.find((visitor) => visitor.phase === 'CHECKOUT' && !visitor.pending)
      if (!front) return false
      update({ ...front, checkoutLeftMs: 0, pending: 'CHECKOUT_DONE' })
      resolvePending()
      advanceQueue()
      notify()
      return true
    },
    clear() {
      if (visitors.length === 0) return
      for (const visitor of visitors) {
        if (visitor.book && !visitor.book.started) hooks.cancel(visitor.book.loanId)
      }
      visitors = []
      deskQueue = []
      untilSpawnMs = config.spawnIntervalMs
      notify()
    },
  }
}
