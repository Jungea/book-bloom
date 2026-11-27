import { afterEach, describe, expect, it, vi } from 'vitest'
import { createVisitorWorld, MAX_TICK_MS } from './visitorWorld'
import type { VisitorConfig } from './visitors'

const config: VisitorConfig = {
  speed: 100,
  browseMs: 1000,
  firstSpawnMs: 1000,
  spawnIntervalMs: 5000,
  maxVisitors: 3,
  entrance: { x: 400, y: 500 },
  corridorY: 300,
  spots: [
    { x: 200, y: 260 },
    { x: 160, y: 270 },
  ],
}

const quiet: VisitorConfig = { ...config, firstSpawnMs: 99_999, spawnIntervalMs: 99_999 }

function run(world: ReturnType<typeof createVisitorWorld>, totalMs: number, stepMs = 100) {
  for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) world.tick(stepMs)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createVisitorWorld', () => {
  it('처음에는 손님이 없고 첫 생성 시간이 지나면 나타난다', () => {
    const world = createVisitorWorld(config)
    expect(world.getVisitors()).toHaveLength(0)

    run(world, 900)
    expect(world.getVisitors()).toHaveLength(0)
    run(world, 200)
    expect(world.getVisitors()).toHaveLength(1)
    expect(world.getVisitors()[0].phase).toBe('ENTERING')
  })

  it('동시 인원은 대기 지점 수를 넘지 않는다', () => {
    const world = createVisitorWorld({ ...config, firstSpawnMs: 0, spawnIntervalMs: 100, maxVisitors: 5 })
    run(world, 2000, 50)
    expect(world.getVisitors()).toHaveLength(2) // 대기 지점이 2개
  })

  it('동시 인원은 maxVisitors도 따른다', () => {
    const world = createVisitorWorld({ ...config, maxVisitors: 1 })
    expect(world.spawn()).toBe(true)
    expect(world.spawn()).toBe(false)
  })

  it('손님마다 다른 대기 지점을 배정하고 퇴장하면 지점이 비워진다', () => {
    const world = createVisitorWorld(quiet)
    world.spawn()
    world.spawn()
    expect(world.getVisitors().map((visitor) => visitor.spot).sort()).toEqual([0, 1])
    expect(world.spawn()).toBe(false)

    // 입장 4.4초 + 구경 1초 + 퇴장 4.4초를 모두 마치도록 진행한다.
    run(world, 12_000, 50)
    expect(world.getVisitors()).toHaveLength(0)
    expect(world.spawn()).toBe(true)
  })

  it('입장해서 구경하고 퇴장한 손님은 목록에서 사라진다', () => {
    const world = createVisitorWorld(quiet)
    world.spawn()
    const phases: string[] = []
    for (let i = 0; i < 200 && world.getVisitors().length > 0; i += 1) {
      world.tick(100)
      const phase = world.getVisitors()[0]?.phase
      if (phase && phases.at(-1) !== phase) phases.push(phase)
    }
    expect(phases).toEqual(['ENTERING', 'BROWSING', 'LEAVING'])
    expect(world.getVisitors()).toHaveLength(0)
  })

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
    // 상한 250ms × 속도 100px/s = 25px
    expect(start.y - moved.y).toBeCloseTo((MAX_TICK_MS * config.speed) / 1000, 5)
  })

  it('시간이 흐르지 않으면 손님은 그 자리에 그대로 있다', () => {
    const world = createVisitorWorld(quiet)
    world.spawn()
    world.tick(200)
    const before = world.getVisitors()[0]
    // 독서 관리 화면에 있는 동안처럼 tick을 부르지 않거나 0 이하만 부른다.
    world.tick(0)
    world.tick(-50)
    expect(world.getVisitors()[0]).toBe(before)
  })

  it('초기화하면 모든 손님이 사라진다', () => {
    const world = createVisitorWorld(config)
    world.spawn()
    world.spawn()
    world.clear()
    expect(world.getVisitors()).toHaveLength(0)
  })
})
