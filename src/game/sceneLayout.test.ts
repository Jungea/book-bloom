import { describe, expect, it } from 'vitest'
import { logicalWidthFor } from './sceneLayout'

describe('logicalWidthFor', () => {
  it('16:9보다 좁거나 같으면 기본 너비 640이다', () => {
    expect(logicalWidthFor(1280, 720)).toBe(640)
    expect(logicalWidthFor(375, 812)).toBe(640)
    expect(logicalWidthFor(400, 700)).toBe(640)
  })

  it('긴 화면에서는 비율에 맞춰 늘어난다', () => {
    expect(logicalWidthFor(1900, 800)).toBe(855)
    expect(logicalWidthFor(2400, 1080)).toBe(800)
  })

  it('크기가 0이거나 숨김 상태(0 나누기)면 null이다', () => {
    expect(logicalWidthFor(0, 0)).toBeNull()
    expect(logicalWidthFor(1280, 0)).toBeNull()
    expect(logicalWidthFor(0, 720)).toBeNull()
  })

  it('유한하지 않거나 음수인 값도 null이다', () => {
    expect(logicalWidthFor(Number.NaN, 720)).toBeNull()
    expect(logicalWidthFor(1280, Number.POSITIVE_INFINITY)).toBeNull()
    expect(logicalWidthFor(-1, 720)).toBeNull()
  })
})
