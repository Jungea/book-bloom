import { describe, expect, it } from 'vitest'
import { createVisitor, routeBetween } from '../core/visitors'
import { FLOOR_Y, HEIGHT } from './sceneLayout'
import { VISITOR_CONFIG, VISITOR_HEIGHT, walkSway } from './visitorLayout'

describe('VISITOR_CONFIG', () => {
  it('입구는 화면 아래 바깥이라 처음에는 보이지 않는다', () => {
    const start = createVisitor('v', 0, VISITOR_CONFIG)
    expect(start.position.y - VISITOR_HEIGHT).toBeGreaterThan(HEIGHT)
  })

  it('책장 앞과 데스크 앞 지점은 가구 기준선 아래 바닥에 있고 서로 겹치지 않는다', () => {
    const points = [...VISITOR_CONFIG.spots, ...VISITOR_CONFIG.deskSlots]
    points.forEach((point) => expect(point.y).toBeGreaterThan(FLOOR_Y))
    const keys = new Set(points.map((point) => `${point.x},${point.y}`))
    expect(keys.size).toBe(points.length)
  })

  it('데스크 줄은 같은 가로줄에 일정한 간격으로 놓인다', () => {
    const slots = VISITOR_CONFIG.deskSlots
    expect(new Set(slots.map((slot) => slot.y)).size).toBe(1)
    slots.slice(1).forEach((slot, i) => expect(slot.x - slots[i].x).toBeGreaterThanOrEqual(32))
  })

  it('동시 방문 인원만큼 책장 앞 지점과 데스크 자리가 있다', () => {
    expect(VISITOR_CONFIG.spots.length).toBeGreaterThanOrEqual(VISITOR_CONFIG.maxVisitors)
    expect(VISITOR_CONFIG.deskSlots.length).toBeGreaterThanOrEqual(VISITOR_CONFIG.maxVisitors)
  })

  it('입구에서 책장·데스크로, 서로 사이를 잇는 경로가 직선 구간뿐이다', () => {
    const { entrance, corridorY, spots, deskSlots } = VISITOR_CONFIG
    const pairs = [
      ...spots.map((spot) => [entrance, spot] as const),
      ...spots.flatMap((spot) => deskSlots.map((slot) => [spot, slot] as const)),
      ...deskSlots.map((slot) => [slot, entrance] as const),
      ...deskSlots.slice(1).map((slot, i) => [slot, deskSlots[i]] as const),
    ]
    for (const [from, to] of pairs) {
      const route = routeBetween(from, to, corridorY)
      route.slice(1).forEach((point, i) => {
        expect(point.x === route[i].x || point.y === route[i].y).toBe(true)
      })
    }
  })
})

describe('walkSway', () => {
  it('흔들림은 작은 범위에 머문다', () => {
    for (let time = 0; time < 2000; time += 37) {
      const { lift, angle } = walkSway(time, 1)
      expect(lift).toBeGreaterThanOrEqual(0)
      expect(lift).toBeLessThanOrEqual(2)
      expect(Math.abs(angle)).toBeLessThanOrEqual(3)
    }
  })
})
