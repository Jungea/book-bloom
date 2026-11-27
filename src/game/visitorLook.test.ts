import { describe, expect, it } from 'vitest'
import {
  BASE_CLOTHES,
  BASE_HAIR,
  CLOTHES_COLORS,
  HAIR_COLORS,
  recolorVisitorPixels,
  visitorLook,
  visitorTextureKey,
} from './visitorLook'

describe('visitorLook', () => {
  it('같은 번호는 항상 같은 외형이다', () => {
    expect(visitorLook(12)).toEqual(visitorLook(12))
    expect(visitorLook(0)).toEqual(visitorLook(0))
  })

  it('번호가 팔레트 범위 안의 값을 돌려준다', () => {
    for (let n = 0; n < 200; n++) {
      const look = visitorLook(n)
      expect(look.hair).toBeGreaterThanOrEqual(0)
      expect(look.hair).toBeLessThan(HAIR_COLORS.length)
      expect(look.clothes).toBeGreaterThanOrEqual(0)
      expect(look.clothes).toBeLessThan(CLOTHES_COLORS.length)
    }
  })

  it('연속한 번호에서 머리색·옷색이 다양하게 나오고 조합도 고르게 섞인다', () => {
    const hairs = new Set<number>()
    const clothes = new Set<number>()
    const combos = new Set<string>()
    for (let n = 1; n <= 60; n++) {
      const look = visitorLook(n)
      hairs.add(look.hair)
      clothes.add(look.clothes)
      combos.add(visitorTextureKey(look))
    }
    expect(hairs.size).toBe(HAIR_COLORS.length)
    expect(clothes.size).toBe(CLOTHES_COLORS.length)
    expect(combos.size).toBeGreaterThan(20)
  })

  it('유효하지 않은 번호는 0번으로 본다', () => {
    expect(visitorLook(Number.NaN)).toEqual(visitorLook(0))
    expect(visitorLook(Number.POSITIVE_INFINITY)).toEqual(visitorLook(0))
  })

  it('팔레트의 첫 색이 원본 색이고 모든 색이 서로 다르다', () => {
    expect(HAIR_COLORS[0]).toEqual(BASE_HAIR)
    expect(CLOTHES_COLORS[0]).toEqual(BASE_CLOTHES)
    expect(new Set(HAIR_COLORS.map((c) => c.join(','))).size).toBe(HAIR_COLORS.length)
    expect(new Set(CLOTHES_COLORS.map((c) => c.join(','))).size).toBe(CLOTHES_COLORS.length)
    for (const c of [...HAIR_COLORS, ...CLOTHES_COLORS]) {
      for (const v of c) expect(v).toBeGreaterThanOrEqual(0)
      for (const v of c) expect(v).toBeLessThanOrEqual(255)
    }
  })

  it('텍스처 이름은 조합마다 다르다', () => {
    expect(visitorTextureKey({ hair: 1, clothes: 2 })).toBe('visitor-h1-c2')
    expect(visitorTextureKey({ hair: 2, clothes: 1 })).not.toBe(visitorTextureKey({ hair: 1, clothes: 2 }))
  })
})

describe('recolorVisitorPixels', () => {
  const SKIN = [226, 175, 140, 255]
  const SHOE = [25, 28, 31, 255]
  const pixels = () =>
    new Uint8ClampedArray([
      ...BASE_HAIR, 255, // 머리
      ...BASE_CLOTHES, 255, // 옷
      ...SKIN, // 피부
      ...SHOE, // 신발
      ...BASE_HAIR, 0, // 투명(머리색이어도 건드리지 않음)
    ])

  it('머리색과 옷색 픽셀만 새 색으로 바꾸고 피부·신발·투명은 그대로 둔다', () => {
    const data = pixels()
    recolorVisitorPixels(data, [1, 2, 3], [4, 5, 6])
    expect(Array.from(data)).toEqual([1, 2, 3, 255, 4, 5, 6, 255, ...SKIN, ...SHOE, ...BASE_HAIR, 0])
  })

  it('원본 색으로 바꾸면 그대로다', () => {
    const data = pixels()
    recolorVisitorPixels(data, BASE_HAIR, BASE_CLOTHES)
    expect(Array.from(data)).toEqual(Array.from(pixels()))
  })
})
