import { describe, expect, it } from 'vitest'
import { MAX_RENDER_ZOOM, logicalWidthFor, renderZoomFor, spriteFilterFor } from './sceneLayout'

describe('spriteFilterFor', () => {
  it('에셋을 줄여 그리는 배율(2 미만)에서는 선형, 같거나 크면 최근접이다', () => {
    expect(spriteFilterFor(1)).toBe('linear')
    expect(spriteFilterFor(1.6)).toBe('linear')
    expect(spriteFilterFor(1.99)).toBe('linear')
    expect(spriteFilterFor(2)).toBe('nearest')
    expect(spriteFilterFor(2.669)).toBe('nearest')
  })
})

describe('renderZoomFor', () => {
  it('실제로 보이는 높이(CSS px)와 화면 배율로 기기 픽셀에 맞는 배율을 구한다', () => {
    expect(renderZoomFor(1280, 720, 1)).toBe(2)
    expect(renderZoomFor(640, 360, 1)).toBe(1)
    // A34 가로: 863×366 CSS px, 화면 배율 2.625 → 논리 849 너비, 보이는 높이 366.
    expect(renderZoomFor(863, 366, 2.625)).toBeCloseTo(2.669, 2)
  })

  it('가로가 모자라 캔버스가 호스트 높이보다 낮게 보이면 보이는 높이로 계산한다', () => {
    // 1024×768 호스트: 논리 640 너비로 맞춰져 보이는 높이는 576.
    expect(renderZoomFor(1024, 768, 1)).toBeCloseTo(1.6, 5)
    // 세로로 긴 화면: 375 너비에 비율 16:9 → 보이는 높이 211.
    expect(renderZoomFor(375, 812, 2)).toBeCloseTo(1.172, 2)
  })

  it('논리 크기보다 작아지지 않고 상한을 넘지 않는다', () => {
    expect(renderZoomFor(320, 200, 1)).toBe(1)
    expect(renderZoomFor(3840, 2160, 2)).toBe(MAX_RENDER_ZOOM)
  })

  it('유효하지 않은 값은 1이다', () => {
    expect(renderZoomFor(0, 0, 2)).toBe(1)
    expect(renderZoomFor(1280, 720, 0)).toBe(1)
    expect(renderZoomFor(Number.NaN, 720, 2)).toBe(1)
    expect(renderZoomFor(1280, 720, Number.POSITIVE_INFINITY)).toBe(1)
    expect(renderZoomFor(-5, 720, 2)).toBe(1)
  })
})

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
