import { describe, expect, it } from 'vitest'
import { RING_FILL_STYLE, RING_RADIUS, RING_TRACK_STYLE, drawRingCanvas, ringTextureSize } from './ringCanvas'

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
    expect(ringTextureSize(1)).toBe(18)
    expect(ringTextureSize(2)).toBe(36)
    expect(ringTextureSize(2.669)).toBe(Math.ceil(18 * 2.669))
  })

  it('유효하지 않은 배율은 1로 본다', () => {
    expect(ringTextureSize(0)).toBe(18)
    expect(ringTextureSize(Number.NaN)).toBe(18)
  })
})

describe('drawRingCanvas', () => {
  it('바탕 원을 그린 뒤 진행률만큼 호를 시계 방향으로 그린다', () => {
    const { ctx, calls } = fakeContext()
    drawRingCanvas(ctx, 36, 2, 0.5)
    const arcs = calls.filter((c) => c.fn === 'arc')
    expect(arcs).toHaveLength(2)
    expect(arcs[0].args).toEqual([18, 18, RING_RADIUS * 2, 0, Math.PI * 2])
    expect(arcs[1].args[0]).toBe(18)
    expect(arcs[1].args[2]).toBe(RING_RADIUS * 2)
    expect(arcs[1].args[3]).toBe(-Math.PI / 2)
    expect(arcs[1].args[4]).toBeCloseTo(Math.PI / 2, 10)
    expect(calls.some((c) => c.fn === `stroke:${RING_TRACK_STYLE}:4`)).toBe(true)
    expect(calls.some((c) => c.fn === `stroke:${RING_FILL_STYLE}:4`)).toBe(true)
  })

  it('진행률 0이면 바탕 원만 그린다', () => {
    const { ctx, calls } = fakeContext()
    drawRingCanvas(ctx, 18, 1, 0)
    expect(calls.filter((c) => c.fn === 'arc')).toHaveLength(1)
  })
})
