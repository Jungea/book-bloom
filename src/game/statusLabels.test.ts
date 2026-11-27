import { describe, expect, it } from 'vitest'
import { storageCountText } from './statusLabels'

describe('storageCountText', () => {
  it('보관함 도서 수를 숫자만으로 만든다(아이콘 옆에 표시)', () => {
    expect(storageCountText(0)).toBe('0')
    expect(storageCountText(10)).toBe('10')
    expect(storageCountText(123)).toBe('123')
  })
})
