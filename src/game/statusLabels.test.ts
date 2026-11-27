import { describe, expect, it } from 'vitest'
import { storageLabel } from './statusLabels'

describe('storageLabel', () => {
  it('보관함 도서 수를 문구로 만든다', () => {
    expect(storageLabel(0)).toBe('보관함 0권')
    expect(storageLabel(10)).toBe('보관함 10권')
  })
})
