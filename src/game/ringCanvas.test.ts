import { describe, expect, it } from 'vitest'
import {
  RING_FILL_STYLE,
  RING_OUTLINE_STYLE,
  RING_RADIUS,
  RING_TRACK_STYLE,
  drawRingCanvas,
  ringTextureSize,
} from './ringCanvas'

/** 호출만 기록하는 가짜 2D 컨텍스트. */
function fakeContext() {
  const calls: { fn: string; args: unknown[] }[] = []
  const ctx = {
    lineWidth: 0,
    strokeStyle: '' as string,
    clearRect: (...args: unknown[]) => calls.push({ fn: 'clearRect', args }),
    beginPath: (...args: unknown[]) => calls.push({ fn: 'beginPath', args }),
    arc: (...args: unknown[]) => calls.push({ fn: 'arc', args }),
    stroke: () => calls.push({ fn: `stroke:${ctx.strokeStyle}:${ctx.lineWidth}`, args: [] }),
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

describe('ringTextureSize', () => {
  it('바깥 반지름과 여백을 담는 정수 크기이고 해상도 배율에 비례한다', () => {
    expect(ringTextureSize(1)).toBe(20)
    expect(ringTextureSize(2)).toBe(40)
    expect(ringTextureSize(2.669)).toBe(Math.ceil(20 * 2.669))
  })

  it('유효하지 않은 배율은 1로 본다', () => {
    expect(ringTextureSize(0)).toBe(20)
    expect(ringTextureSize(Number.NaN)).toBe(20)
  })
})

describe('drawRingCanvas', () => {
  it('어두운 테두리, 흰 바탕 원, 진행률만큼의 파란 호를 순서대로 그린다', () => {
    const { ctx, calls } = fakeContext()
    drawRingCanvas(ctx, 40, 2, 0.5)
    const arcs = calls.filter((c) => c.fn === 'arc')
    expect(arcs).toHaveLength(3)
    expect(arcs[0].args).toEqual([20, 20, RING_RADIUS * 2, 0, Math.PI * 2])
    expect(arcs[1].args).toEqual([20, 20, RING_RADIUS * 2, 0, Math.PI * 2])
    expect(arcs[2].args[3]).toBe(-Math.PI / 2)
    expect(arcs[2].args[4]).toBeCloseTo(Math.PI / 2, 10)
    const strokes = calls.filter((c) => c.fn.startsWith('stroke:')).map((c) => c.fn)
    // 테두리(두께 4×배율 2 = 8) → 바탕(2×2 = 4) → 채움(4)
    expect(strokes).toEqual([
      `stroke:${RING_OUTLINE_STYLE}:8`,
      `stroke:${RING_TRACK_STYLE}:4`,
      `stroke:${RING_FILL_STYLE}:4`,
    ])
  })

  it('진행률 0이면 테두리와 바탕 원만 그린다', () => {
    const { ctx, calls } = fakeContext()
    drawRingCanvas(ctx, 20, 1, 0)
    expect(calls.filter((c) => c.fn === 'arc')).toHaveLength(2)
  })
})
