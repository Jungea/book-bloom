import { describe, expect, it } from 'vitest'
import {
  INNER_LEFT,
  INNER_RIGHT,
  ROW_BASELINES,
  SLOTS_PER_ROW,
  SLOT_WIDTH,
  SPINE_VARIANTS,
  TEMP_SHELF_CAPACITY,
  slotPosition,
  spineVariant,
} from './shelfLayout'

describe('slotPosition', () => {
  it('위 칸 왼쪽부터 채운다', () => {
    expect(slotPosition(0)).toEqual({ x: INNER_LEFT + SLOT_WIDTH / 2, y: ROW_BASELINES[0] })
    expect(slotPosition(1).x).toBe(slotPosition(0).x + SLOT_WIDTH)
    expect(slotPosition(SLOTS_PER_ROW)).toEqual({
      x: INNER_LEFT + SLOT_WIDTH / 2,
      y: ROW_BASELINES[1],
    })
  })

  it('모든 슬롯이 선반 안쪽에 들어온다', () => {
    for (let slot = 0; slot < TEMP_SHELF_CAPACITY; slot += 1) {
      const { x } = slotPosition(slot)
      expect(x - SLOT_WIDTH / 2).toBeGreaterThanOrEqual(INNER_LEFT)
      expect(x + SLOT_WIDTH / 2).toBeLessThanOrEqual(INNER_RIGHT)
    }
  })

  it('범위를 벗어난 슬롯은 거부한다', () => {
    expect(() => slotPosition(-1)).toThrow(RangeError)
    expect(() => slotPosition(TEMP_SHELF_CAPACITY)).toThrow(RangeError)
  })
})

describe('spineVariant', () => {
  it('같은 id는 항상 같은 색을 고른다', () => {
    expect(spineVariant('debug-7')).toBe(spineVariant('debug-7'))
  })

  it('색 범위 안의 정수를 돌려준다', () => {
    for (let n = 0; n < 50; n += 1) {
      const variant = spineVariant(`debug-${n}`)
      expect(Number.isInteger(variant)).toBe(true)
      expect(variant).toBeGreaterThanOrEqual(0)
      expect(variant).toBeLessThan(SPINE_VARIANTS)
    }
  })
})
