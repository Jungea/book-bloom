import { describe, expect, it } from 'vitest'
import { ringArc } from './progressRing'

describe('ringArc', () => {
  it('12시 방향에서 시작해 진행률만큼 시계 방향으로 찬다', () => {
    expect(ringArc(0)).toEqual({ start: -Math.PI / 2, end: -Math.PI / 2 })
    expect(ringArc(0.25).end).toBeCloseTo(0)
    expect(ringArc(0.5).end).toBeCloseTo(Math.PI / 2)
    expect(ringArc(1).end).toBeCloseTo((3 * Math.PI) / 2)
  })

  it('범위를 벗어난 값과 숫자가 아닌 값은 0~1로 맞춘다', () => {
    expect(ringArc(-1)).toEqual(ringArc(0))
    expect(ringArc(2)).toEqual(ringArc(1))
    expect(ringArc(Number.NaN)).toEqual(ringArc(0))
  })
})
