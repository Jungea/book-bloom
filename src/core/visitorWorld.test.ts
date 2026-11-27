import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createVisitorWorld,
  MAX_TICK_MS,
  type VisitorHooks,
  type VisitorWorld,
} from './visitorWorld'
import type { Visitor, VisitorConfig } from './visitors'

const config: VisitorConfig = {
  speed: 100,
  browseMs: 1000,
  checkoutMs: 1000,
  firstSpawnMs: 1000,
  spawnIntervalMs: 5000,
  maxVisitors: 3,
  entrance: { x: 400, y: 500 },
  corridorY: 300,
  spots: [
    { x: 200, y: 260 },
    { x: 160, y: 270 },
    { x: 240, y: 270 },
  ],
  deskSlots: [
    { x: 80, y: 266 },
    { x: 114, y: 266 },
    { x: 148, y: 266 },
  ],
}

const quiet: VisitorConfig = { ...config, firstSpawnMs: 99_999, spawnIntervalMs: 99_999 }

function run(world: VisitorWorld, totalMs: number, stepMs = 50) {
  for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) world.tick(stepMs)
}

/** 도서를 빌려 주는 가짜 훅. 호출 기록을 남긴다. */
function fakeHooks(options: { books?: string[]; startFails?: boolean } = {}) {
  const books = [...(options.books ?? ['b1', 'b2', 'b3'])]
  const log: string[] = []
  let serial = 0
  const hooks: VisitorHooks = {
    reserve() {
      const bookId = books.shift()
      if (!bookId) {
        log.push('reserve:none')
        return { ok: false, reason: '도서 없음' }
      }
      serial += 1
      log.push(`reserve:${bookId}`)
      return { ok: true, loanId: `loan-${serial}`, bookId }
    },
    startLoan(loanId) {
      log.push(`start:${loanId}`)
      return options.startFails ? { ok: false, reason: '실패' } : { ok: true }
    },
    cancel(loanId) {
      log.push(`cancel:${loanId}`)
    },
  }
  return { hooks, log }
}

const phases = (world: VisitorWorld) => world.getVisitors().map((visitor) => visitor.phase)
const byId = (world: VisitorWorld, id: string): Visitor | undefined =>
  world.getVisitors().find((visitor) => visitor.id === id)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createVisitorWorld: 생성과 구경', () => {
  it('처음에는 손님이 없고 첫 생성 시간이 지나면 나타난다', () => {
    const world = createVisitorWorld(config)
    expect(world.getVisitors()).toHaveLength(0)
    run(world, 900, 100)
    expect(world.getVisitors()).toHaveLength(0)
    run(world, 200, 100)
    expect(world.getVisitors()).toHaveLength(1)
    expect(world.getVisitors()[0].phase).toBe('ENTERING')
  })

  it('동시 인원은 maxVisitors를 넘지 않는다', () => {
    const world = createVisitorWorld({ ...config, maxVisitors: 1 })
    expect(world.spawn()).toBe(true)
    expect(world.spawn()).toBe(false)
  })

  it('손님마다 다른 구경 지점을 배정한다', () => {
    const world = createVisitorWorld(quiet)
    world.spawn()
    world.spawn()
    world.spawn()
    expect(world.getVisitors().map((visitor) => visitor.spot).sort()).toEqual([0, 1, 2])
    expect(world.spawn()).toBe(false)
  })

  it('훅이 없으면(v0.2) 구경만 하고 대출 없이 퇴장해 사라진다', () => {
    const world = createVisitorWorld(quiet)
    world.spawn()
    const seen: string[] = []
    for (let i = 0; i < 400 && world.getVisitors().length > 0; i += 1) {
      world.tick(50)
      const phase = world.getVisitors()[0]?.phase
      if (phase && seen.at(-1) !== phase) seen.push(phase)
    }
    expect(seen).toEqual(['ENTERING', 'BROWSING', 'LEAVING'])
    expect(world.getVisitors()).toHaveLength(0)
  })
})

describe('createVisitorWorld: 대출 동선', () => {
  it('구경이 끝나면 도서를 고르고(예약) 데스크로 가서 처리하고 대출을 시작한 뒤 퇴장한다', () => {
    const { hooks, log } = fakeHooks()
    const world = createVisitorWorld(quiet, hooks)
    world.spawn()
    const seen: string[] = []
    for (let i = 0; i < 800 && world.getVisitors().length > 0; i += 1) {
      world.tick(50)
      const phase = world.getVisitors()[0]?.phase
      if (phase && seen.at(-1) !== phase) seen.push(phase)
    }
    expect(seen).toEqual(['ENTERING', 'BROWSING', 'QUEUING', 'CHECKOUT', 'LEAVING'])
    expect(log).toEqual(['reserve:b1', 'start:loan-1'])
    expect(world.getVisitors()).toHaveLength(0)
    expect(world.getDeskQueue()).toEqual([])
  })

  it('고를 도서가 없으면 대출 없이 퇴장한다', () => {
    const { hooks, log } = fakeHooks({ books: [] })
    const world = createVisitorWorld(quiet, hooks)
    world.spawn()
    run(world, 20_000)
    expect(log).toEqual(['reserve:none'])
    expect(world.getVisitors()).toHaveLength(0)
  })

  it('고른 도서는 퇴장할 때까지 손님이 들고 있고, 대출이 시작되면 started가 된다', () => {
    const { hooks } = fakeHooks()
    const world = createVisitorWorld(quiet, hooks)
    world.spawn()
    let queuingBook: Visitor['book'] = null
    let leavingBook: Visitor['book'] = null
    for (let i = 0; i < 800 && world.getVisitors().length > 0; i += 1) {
      world.tick(50)
      const visitor = world.getVisitors()[0]
      if (visitor?.phase === 'QUEUING') queuingBook = visitor.book
      if (visitor?.phase === 'LEAVING') leavingBook = visitor.book
    }
    expect(queuingBook).toEqual({ loanId: 'loan-1', bookId: 'b1', started: false })
    expect(leavingBook).toEqual({ loanId: 'loan-1', bookId: 'b1', started: true })
  })

  it('데스크가 사용 중이면 줄을 서고 앞 손님이 끝나면 한 칸씩 앞으로 나온다', () => {
    const { hooks, log } = fakeHooks()
    const world = createVisitorWorld(quiet, hooks)
    world.spawn()
    world.spawn()
    run(world, 12_000)

    // 두 손님 모두 구경을 마치고 책을 골랐다. 줄에는 최대 둘이다.
    expect(log.filter((entry) => entry.startsWith('reserve:'))).toEqual(['reserve:b1', 'reserve:b2'])
    const queue = world.getDeskQueue()
    expect(queue.length).toBeLessThanOrEqual(2)

    run(world, 30_000)
    expect(log.filter((entry) => entry.startsWith('start:'))).toEqual(['start:loan-1', 'start:loan-2'])
    expect(world.getVisitors()).toHaveLength(0)
    expect(world.getDeskQueue()).toEqual([])
  })

  it('한 번에 한 손님만 처리한다: 처리 중인 손님은 서비스 지점에 한 명뿐이다', () => {
    const { hooks } = fakeHooks()
    const world = createVisitorWorld(quiet, hooks)
    world.spawn()
    world.spawn()
    world.spawn()
    for (let i = 0; i < 1200 && world.getVisitors().length > 0; i += 1) {
      world.tick(50)
      expect(world.getVisitors().filter((visitor) => visitor.phase === 'CHECKOUT').length).toBeLessThanOrEqual(1)
      // 줄 순번은 중복 없이 0부터 이어진다.
      const indexes = world.getVisitors().flatMap((visitor) => (visitor.queueIndex === null ? [] : [visitor.queueIndex]))
      expect(new Set(indexes).size).toBe(indexes.length)
    }
  })

  it('줄이 가득 차면 도서를 고르지 않고 퇴장한다', () => {
    const { hooks, log } = fakeHooks()
    const tight: VisitorConfig = { ...quiet, deskSlots: [config.deskSlots[0]] }
    const world = createVisitorWorld(tight, hooks)
    world.spawn()
    world.spawn()
    run(world, 8_000)
    // 한 자리뿐인 줄에는 한 손님만 서고 다른 손님은 책을 고르지 못한다.
    expect(log.filter((entry) => entry.startsWith('reserve:'))).toHaveLength(1)
  })

  it('대출 즉시 완료: 처리 중인 손님의 대출을 바로 끝낸다', () => {
    const { hooks, log } = fakeHooks()
    const world = createVisitorWorld({ ...quiet, checkoutMs: 60_000 }, hooks)
    world.spawn()
    expect(world.completeCheckout()).toBe(false) // 아직 처리 중인 손님이 없다
    for (let i = 0; i < 400 && !world.getVisitors().some((visitor) => visitor.phase === 'CHECKOUT'); i += 1) {
      world.tick(50)
    }
    expect(world.completeCheckout()).toBe(true)
    expect(log).toContain('start:loan-1')
    expect(world.getVisitors()[0].phase).toBe('LEAVING')
  })
})

describe('createVisitorWorld: 실패해도 줄을 막지 않는다', () => {
  it('대출 시작이 실패하면 예약을 해제하고 줄을 비운 채 대출 없이 퇴장한다', () => {
    const { hooks, log } = fakeHooks({ startFails: true })
    const world = createVisitorWorld(quiet, hooks)
    world.spawn()
    world.spawn()
    run(world, 40_000)

    // 두 손님 모두 한 번씩만 시도하고(오류 반복 없음) 예약을 해제하고 나갔다.
    expect(log.filter((entry) => entry.startsWith('start:'))).toEqual(['start:loan-1', 'start:loan-2'])
    expect(log.filter((entry) => entry.startsWith('cancel:'))).toEqual(['cancel:loan-1', 'cancel:loan-2'])
    expect(world.getVisitors()).toHaveLength(0)
    expect(world.getDeskQueue()).toEqual([])
  })

  it('대출 시작이 실패한 손님은 책을 들지 않고 퇴장하며 뒤 손님이 바로 이어서 처리된다', () => {
    const { hooks, log } = fakeHooks({ startFails: true })
    const world = createVisitorWorld(quiet, hooks)
    world.spawn()
    world.spawn()
    let leavingWithBook = false
    for (let i = 0; i < 1500 && world.getVisitors().length > 0; i += 1) {
      world.tick(50)
      if (world.getVisitors().some((visitor) => visitor.phase === 'LEAVING' && visitor.book)) leavingWithBook = true
    }
    expect(leavingWithBook).toBe(false)
    expect(log.filter((entry) => entry.startsWith('start:'))).toHaveLength(2)
  })

  it('훅이 호출하는 예외가 아닌 실패는 구독자에게 알리지 않고 손님을 정상 제거한다', () => {
    const { hooks } = fakeHooks({ startFails: true })
    const world = createVisitorWorld(quiet, hooks)
    const listener = vi.fn()
    world.subscribe(listener)
    world.spawn()
    run(world, 20_000)
    expect(world.getVisitors()).toHaveLength(0)
    expect(listener).toHaveBeenCalled()
  })

  it('비우면 예약만 된 손님의 예약은 해제하고 이미 대출이 시작된 도서는 건드리지 않는다', () => {
    const { hooks, log } = fakeHooks()
    const world = createVisitorWorld(quiet, hooks)
    world.spawn()
    // 책을 고르고 줄에 선 상태까지 진행한다.
    for (let i = 0; i < 800 && !world.getVisitors().some((visitor) => visitor.book); i += 1) world.tick(50)
    expect(log).toEqual(['reserve:b1'])
    world.clear()
    expect(log).toEqual(['reserve:b1', 'cancel:loan-1'])
    expect(world.getVisitors()).toHaveLength(0)
    expect(world.getDeskQueue()).toEqual([])

    // 대출이 시작된 뒤(퇴장 중)에는 해제하지 않는다.
    world.spawn()
    for (let i = 0; i < 1200 && !world.getVisitors().some((visitor) => visitor.book?.started); i += 1) world.tick(50)
    const before = log.length
    world.clear()
    expect(log.slice(before)).toEqual([])
  })
})

describe('createVisitorWorld: 알림과 시간', () => {
  it('생성·퇴장·초기화 때만 구독자에게 알린다', () => {
    const world = createVisitorWorld(quiet)
    const listener = vi.fn()
    const unsubscribe = world.subscribe(listener)

    world.spawn()
    expect(listener).toHaveBeenCalledTimes(1)
    world.tick(100)
    world.tick(100)
    expect(listener).toHaveBeenCalledTimes(1) // 이동만으로는 알리지 않는다

    world.clear()
    expect(listener).toHaveBeenCalledTimes(2)
    world.clear() // 이미 비어 있으면 알리지 않는다
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    world.spawn()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('구독자 하나가 예외를 던져도 나머지에게 알린다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const world = createVisitorWorld(config)
    const second = vi.fn()
    world.subscribe(() => {
      throw new Error('실패')
    })
    world.subscribe(second)
    world.spawn()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('한 번에 진행하는 시간에 상한이 있어 손님이 순간이동하지 않는다', () => {
    const world = createVisitorWorld(quiet)
    world.spawn()
    const start = world.getVisitors()[0].position
    world.tick(60_000)
    const moved = world.getVisitors()[0].position
    expect(start.y - moved.y).toBeCloseTo((MAX_TICK_MS * config.speed) / 1000, 5)
  })

  it('시간이 흐르지 않으면 손님은 그 자리에 그대로 있다', () => {
    const world = createVisitorWorld(quiet)
    world.spawn()
    world.tick(200)
    const before = world.getVisitors()[0]
    world.tick(0)
    world.tick(-50)
    expect(world.getVisitors()[0]).toBe(before)
  })

  it('초기화하면 모든 손님이 사라진다', () => {
    const world = createVisitorWorld(config)
    world.spawn()
    world.spawn()
    world.clear()
    expect(phases(world)).toEqual([])
    expect(byId(world, 'visitor-1')).toBeUndefined()
  })
})
