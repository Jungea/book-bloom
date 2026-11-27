import { describe, expect, it } from 'vitest'
import { createVisitor, entryRoute } from '../core/visitors'
import { HEIGHT } from './sceneLayout'
import { VISITOR_CONFIG, VISITOR_HEIGHT, walkSway } from './visitorLayout'

describe('VISITOR_CONFIG', () => {
  it('입구는 화면 아래 바깥이라 처음에는 보이지 않는다', () => {
    const start = createVisitor('v', 0, VISITOR_CONFIG)
    // 발이 화면 아래 끝보다 아래이고, 머리 끝도 화면 아래 끝 밖이다.
    expect(start.position.y - VISITOR_HEIGHT).toBeGreaterThan(HEIGHT)
  })

  it('대기 지점은 책장 앞 바닥(가구 기준선 아래)에 있고 서로 겹치지 않는다', () => {
    const spots = VISITOR_CONFIG.spots
    spots.forEach((spot) => expect(spot.y).toBeGreaterThan(240))
    const keys = new Set(spots.map((spot) => `${spot.x},${spot.y}`))
    expect(keys.size).toBe(spots.length)
  })

  it('모든 대기 지점으로 이어지는 경로가 있고 직선 구간뿐이다', () => {
    VISITOR_CONFIG.spots.forEach((_, index) => {
      const route = entryRoute(VISITOR_CONFIG, index)
      route.slice(1).forEach((point, i) => {
        const previous = route[i]
        expect(point.x === previous.x || point.y === previous.y).toBe(true)
      })
    })
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
