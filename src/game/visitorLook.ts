/**
 * 손님 외형(머리색·옷색) 다양화. 손님 스프라이트는 한 장(`visitor_idle.png`)이라, 두 색(머리·옷)만 다른 색으로 바꾼
 * 변형 텍스처를 만들어 쓴다. 머리 모양·피부색·신발은 그대로다(머리 모양은 에셋이 하나라 유지).
 * 외형은 손님 번호로 정해져 항상 같다(저장하지 않는다, 손님은 메모리에만 있다).
 */

export type Rgb = readonly [number, number, number]

/** 원본 에셋의 색(`assets/source/v4/characters/visitor_idle.png`). 이 두 색만 바꾼다. */
export const BASE_HAIR: Rgb = [80, 64, 51]
export const BASE_CLOTHES: Rgb = [101, 131, 121]

/** 머리색. 첫째가 원본이다. */
export const HAIR_COLORS: readonly Rgb[] = [
  BASE_HAIR, // 갈색
  [38, 34, 36], // 검정
  [122, 62, 42], // 적갈색
  [201, 166, 92], // 금발
  [46, 56, 96], // 짙은 남색(회색 계열은 회색 바닥과 구분이 안 되어 뺀다)
]

/** 옷색. 첫째가 원본이다. 채도를 낮춘 도서관 분위기의 색으로 고른다. */
export const CLOTHES_COLORS: readonly Rgb[] = [
  BASE_CLOTHES, // 세이지
  [96, 125, 165], // 먼지 파랑
  [178, 98, 80], // 테라코타
  [196, 160, 72], // 겨자
  [130, 92, 130], // 자두
  [66, 128, 138], // 청록
  [190, 120, 135], // 분홍
  [88, 92, 104], // 숯색
]

export interface VisitorLook {
  readonly hair: number
  readonly clothes: number
}

/**
 * 손님 번호로 머리색·옷색 번호를 정한다(같은 번호는 항상 같다). 연속한 번호가 비슷해 보이지 않도록 해시를 쓰고,
 * 머리와 옷은 해시의 서로 다른 자리를 써서 조합이 고르게 섞이게 한다.
 */
export function visitorLook(visitorNumber: number): VisitorLook {
  const n = Number.isFinite(visitorNumber) ? Math.trunc(visitorNumber) : 0
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  return { hair: h % HAIR_COLORS.length, clothes: (h >>> 8) % CLOTHES_COLORS.length }
}

/** 변형 텍스처의 이름. */
export function visitorTextureKey(look: VisitorLook): string {
  return `visitor-h${look.hair}-c${look.clothes}`
}

/**
 * RGBA 픽셀 배열에서 원본 머리색·옷색인 픽셀만 새 색으로 바꾼다(알파·다른 색은 그대로). 배열을 직접 바꾼다.
 * 정확히 같은 색만 바꾸므로 피부색·신발(검정)은 영향이 없다.
 */
export function recolorVisitorPixels(data: Uint8ClampedArray, hair: Rgb, clothes: Rgb): void {
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (r === BASE_HAIR[0] && g === BASE_HAIR[1] && b === BASE_HAIR[2]) {
      data[i] = hair[0]
      data[i + 1] = hair[1]
      data[i + 2] = hair[2]
    } else if (r === BASE_CLOTHES[0] && g === BASE_CLOTHES[1] && b === BASE_CLOTHES[2]) {
      data[i] = clothes[0]
      data[i + 1] = clothes[1]
      data[i + 2] = clothes[2]
    }
  }
}
