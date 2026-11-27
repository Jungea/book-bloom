import { describe, expect, it } from 'vitest'
import { carriedBookPlacement } from './carriedBook'
import { CARRIED_BOOK_MAX_THICKNESS, VISITOR_HEAD_CENTER_X, VISITOR_HEAD_TOP } from './visitorLayout'

const feet = { x: 100, y: 300 }

describe('carriedBookPlacement: 머리 위에 가로로 얹힌 책', () => {
  it('책을 90°로 눕혀 머리 윗면 바로 위에 놓는다(흔들림이 없을 때)', () => {
    const placement = carriedBookPlacement(feet, 0, 8)
    expect(placement.angle).toBe(90) // 세로로 긴 책등을 가로로 눕힌 방향
    expect(placement.x).toBeCloseTo(feet.x + VISITOR_HEAD_CENTER_X, 5) // 머리 가운데
    // 책의 아래 면(가운데에서 두께의 절반 아래)이 머리 윗면과 닿는다.
    expect(placement.y + 8 / 2).toBeCloseTo(feet.y - VISITOR_HEAD_TOP, 5)
  })

  it('두꺼운 책일수록 가운데가 두께의 절반만큼 더 올라가지만 아래 면은 항상 머리 윗면이다', () => {
    for (const thickness of [6, 8, 10, CARRIED_BOOK_MAX_THICKNESS]) {
      const placement = carriedBookPlacement(feet, 0, thickness)
      expect(placement.y + thickness / 2).toBeCloseTo(feet.y - VISITOR_HEAD_TOP, 5)
    }
  })

  it('손님이 흔들리면 책도 같은 각도로 함께 기울어 머리 위에 평평하게 얹힌 채 따라간다', () => {
    for (const sway of [-3, -1.5, 1.5, 3]) {
      const placement = carriedBookPlacement(feet, sway, 8)
      expect(placement.angle).toBeCloseTo(90 + sway, 5)
      // 발에서 책 가운데까지의 거리는 흔들려도 같다(머리와 책의 간격이 변하지 않는다).
      const still = carriedBookPlacement(feet, 0, 8)
      const distance = (p: { x: number; y: number }) => Math.hypot(p.x - feet.x, p.y - feet.y)
      expect(distance(placement)).toBeCloseTo(distance(still), 3)
    }
  })

  it('시계 방향(+)으로 기울면 책이 오른쪽으로, 반대로 기울면 왼쪽으로 따라간다', () => {
    expect(carriedBookPlacement(feet, 3, 8).x).toBeGreaterThan(carriedBookPlacement(feet, 0, 8).x)
    expect(carriedBookPlacement(feet, -3, 8).x).toBeLessThan(carriedBookPlacement(feet, 0, 8).x)
  })

  it('걷는 동안의 들썩임(발 y가 올라감)도 그대로 따라간다', () => {
    const lifted = carriedBookPlacement({ x: 100, y: 298 }, 0, 8)
    const normal = carriedBookPlacement(feet, 0, 8)
    expect(normal.y - lifted.y).toBeCloseTo(2, 5)
    expect(lifted.angle).toBe(normal.angle)
  })

  it('예약 후 이동할 때와 대출 완료 후 퇴장할 때 같은 방향이다(상태와 무관하게 같은 함수)', () => {
    const whileMoving = carriedBookPlacement(feet, 2, 8)
    const whileLeaving = carriedBookPlacement(feet, 2, 8)
    expect(whileLeaving).toEqual(whileMoving)
    expect(((whileMoving.angle % 360) + 360) % 360).toBeGreaterThan(80)
    expect(((whileMoving.angle % 360) + 360) % 360).toBeLessThan(100)
  })
})
