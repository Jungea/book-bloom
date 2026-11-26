import type { GameSnapshot } from '../reading/gameSnapshot'
import type { GameStorage } from './gameStorage'

const STORE_NAME = 'game'
const LIBRARY_KEY = 'library'
const CORRUPTED_KEY = 'library-corrupted'

function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('이 환경에서는 IndexedDB를 사용할 수 없습니다.'))
      return
    }
    const request = indexedDB.open(name, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('저장소를 열지 못했습니다.'))
    request.onblocked = () => reject(new Error('다른 탭이 저장소를 사용 중이라 열지 못했습니다.'))
  })
}

function transact<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const request = work(transaction.objectStore(STORE_NAME))
    // 쓰기는 트랜잭션이 완전히 끝난 뒤에 성공으로 본다.
    transaction.oncomplete = () => resolve(request.result)
    transaction.onerror = () => reject(transaction.error ?? request.error)
    transaction.onabort = () => reject(transaction.error ?? new Error('저장소 작업이 중단되었습니다.'))
  })
}

/** 브라우저 내장 IndexedDB를 쓰는 저장소. 데이터베이스 이름으로 일반 데이터와 테스트 데이터를 나눈다. */
export function createIndexedDbStorage(databaseName: string): GameStorage {
  let opened: Promise<IDBDatabase> | null = null
  const database = () => {
    opened ??= openDatabase(databaseName).catch((error: unknown) => {
      opened = null // 다음 호출에서 다시 열어 본다.
      throw error
    })
    return opened
  }

  return {
    async load() {
      const db = await database()
      const value = await transact<unknown>(db, 'readonly', (store) => store.get(LIBRARY_KEY))
      return value ?? null
    },
    async save(snapshot: GameSnapshot) {
      const db = await database()
      await transact(db, 'readwrite', (store) => store.put(snapshot, LIBRARY_KEY))
    },
    async clear() {
      const db = await database()
      await transact(db, 'readwrite', (store) => store.delete(LIBRARY_KEY))
    },
    async quarantine(raw: unknown) {
      const db = await database()
      await transact(db, 'readwrite', (store) => store.put(raw, CORRUPTED_KEY))
    },
  }
}
