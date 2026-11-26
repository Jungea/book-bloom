import type { LibrarySnapshot } from '../core/librarySnapshot'

/**
 * 도서관 상태의 저장소 경계. 코어와 UI는 이 인터페이스만 안다.
 * 서버 동기화를 붙일 때도 구현만 바꾸거나 감싸면 된다.
 */
export interface LibraryStorage {
  /** 저장된 값을 있는 그대로 돌려준다. 없으면 null. 검증은 restoreLibrary가 한다. */
  load(): Promise<unknown | null>
  save(snapshot: LibrarySnapshot): Promise<void>
  clear(): Promise<void>
  /** 복원하지 못한 저장 데이터를 덮어쓰기 전에 따로 보관한다. 가장 최근 1건만 유지한다. */
  quarantine(raw: unknown): Promise<void>
}
