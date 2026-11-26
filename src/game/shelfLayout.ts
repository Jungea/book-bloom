// V4 bookshelf_empty.png(256×352, 논리 128×176)에서 측정한 선반 좌표다.
// manifest.json에는 선반 슬롯 정보가 없어 PNG에서 직접 읽었다.
// 모든 값은 논리 좌표(640×360 기준)이며 책장 이미지의 왼쪽 위를 원점으로 한다.

export const SHELF_WIDTH = 128
export const SHELF_HEIGHT = 176

/** 책이 놓이는 선반 윗면 Y. 위 칸부터 순서대로. */
export const ROW_BASELINES = [38, 74, 110, 146] as const
/** 선반 안쪽 좌우 끝 X. */
export const INNER_LEFT = 7
export const INNER_RIGHT = 121
/** 책 한 권이 차지하는 가로 폭. 가장 넓은 책등(10px)에 맞춘다. */
export const SLOT_WIDTH = 10

export const SLOTS_PER_ROW = Math.floor((INNER_RIGHT - INNER_LEFT) / SLOT_WIDTH)

// 임시 상수: 책장 용량은 기획에서 미정이다(docs/02 "책장 용량" 미정).
// 테스트 패널과 렌더링 검증을 위해 선반에 물리적으로 들어가는 개수를 쓴다.
export const TEMP_SHELF_CAPACITY = ROW_BASELINES.length * SLOTS_PER_ROW

export const SPINE_VARIANTS = 5

export interface SlotPosition {
  /** 책등 가로 중심. */
  readonly x: number
  /** 책등 아래쪽(선반 윗면). */
  readonly y: number
}

/** 슬롯 번호를 선반 이미지 기준 좌표로 바꾼다. 위 칸의 왼쪽부터 채운다. */
export function slotPosition(slot: number): SlotPosition {
  const row = Math.floor(slot / SLOTS_PER_ROW)
  const col = slot % SLOTS_PER_ROW
  if (slot < 0 || row >= ROW_BASELINES.length) {
    throw new RangeError(`선반에 없는 슬롯 번호입니다: ${slot}`)
  }
  return {
    x: INNER_LEFT + col * SLOT_WIDTH + SLOT_WIDTH / 2,
    y: ROW_BASELINES[row],
  }
}

/** 도서 id마다 같은 책등 색을 고르도록 문자열을 5가지 중 하나로 매핑한다. */
export function spineVariant(bookId: string): number {
  let hash = 0
  for (let i = 0; i < bookId.length; i += 1) {
    hash = (hash * 31 + bookId.charCodeAt(i)) >>> 0
  }
  return hash % SPINE_VARIANTS
}
