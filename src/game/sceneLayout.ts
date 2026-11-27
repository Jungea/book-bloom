// 도서관 장면의 기준 좌표(논리 640×360). 장면과 손님 경로가 함께 쓴다.

export const BASE_WIDTH = 640
export const HEIGHT = 360
export const STATUS_HEIGHT = 32
export const FLOOR_Y = 240
/** 4슬롯의 가로 중심: 데스크, 책장, 빈 슬롯, 반납 트레이. */
export const SLOT_CENTERS = [80, 240, 400, 560] as const
