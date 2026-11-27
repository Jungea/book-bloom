import Phaser from 'phaser'
import wallUrl from '../../assets/source/v4/backgrounds/wall_tile.png'
import floorUrl from '../../assets/source/v4/backgrounds/floor_tile.png'
import baseboardUrl from '../../assets/source/v4/backgrounds/baseboard_tile.png'
import statusBarUrl from '../../assets/source/v4/ui/status_bar.png'
import deskUrl from '../../assets/source/v4/circulation/circulation_desk.png'
import monitorUrl from '../../assets/source/v4/circulation/desk_monitor.png'
import bookshelfUrl from '../../assets/source/v4/bookshelves/bookshelf_empty.png'
import returnTrayUrl from '../../assets/source/v4/circulation/return_tray_empty.png'
import spineBlueUrl from '../../assets/source/v4/books/book_spine_blue.png'
import spineCreamUrl from '../../assets/source/v4/books/book_spine_cream.png'
import spineGrayUrl from '../../assets/source/v4/books/book_spine_gray.png'
import spineRedUrl from '../../assets/source/v4/books/book_spine_red.png'
import spineTaupeUrl from '../../assets/source/v4/books/book_spine_taupe.png'
import visitorUrl from '../../assets/source/v4/characters/visitor_idle.png'
import { bookStatus } from '../core/circulation'
import { storedCount, type LibraryState } from '../core/library'
import { isWalking } from '../core/visitors'
import type { VisitorWorld } from '../core/visitorWorld'
import type { GameStore } from '../reading/gameStore'
import { SHELF_HEIGHT, SHELF_WIDTH, slotPosition, spineVariant } from './shelfLayout'
import { BASE_WIDTH, FLOOR_Y, HEIGHT, SLOT_CENTERS, STATUS_HEIGHT } from './sceneLayout'
import { storageLabel } from './statusLabels'
import { VISITOR_HEIGHT, walkSway } from './visitorLayout'

export const GAME_STORE_KEY = 'gameStore'
export const VISITOR_WORLD_KEY = 'visitorWorld'

const SPINE_URLS = [spineBlueUrl, spineCreamUrl, spineGrayUrl, spineRedUrl, spineTaupeUrl]

// 상태바 이미지 오른쪽에 있는 자리 표시 칸(논리 x 452~630)과 겹치지 않게 그 왼쪽 끝에 맞춘다.
const STORAGE_LABEL_RIGHT = 440

/** 손님 id(`visitor-12`)의 번호. 흔들림의 위상을 손님마다 다르게 하는 데 쓴다. */
function visitorNumber(id: string): number {
  return Number(id.split('-')[1]) || 0
}

export class LibraryScene extends Phaser.Scene {
  private shelfOrigin = { x: 0, y: 0 }
  private bookImages: Phaser.GameObjects.Image[] = []
  private storageText: Phaser.GameObjects.Text | null = null
  private visitorWorld: VisitorWorld | null = null
  private visitorImages = new Map<string, Phaser.GameObjects.Image>()
  private carriedBookImages = new Map<string, Phaser.GameObjects.Image>()

  constructor() {
    super('LibraryScene')
  }

  preload() {
    this.load.image('wall', wallUrl)
    this.load.image('floor', floorUrl)
    this.load.image('baseboard', baseboardUrl)
    this.load.image('statusBar', statusBarUrl)
    this.load.image('desk', deskUrl)
    this.load.image('monitor', monitorUrl)
    this.load.image('bookshelf', bookshelfUrl)
    this.load.image('returnTray', returnTrayUrl)
    this.load.image('visitor', visitorUrl)
    SPINE_URLS.forEach((url, i) => this.load.image(`spine${i}`, url))
  }

  create() {
    const width = this.scale.width
    const offset = (width - BASE_WIDTH) / 2

    this.add.tileSprite(
      width / 2,
      (STATUS_HEIGHT + FLOOR_Y) / 2,
      width,
      FLOOR_Y - STATUS_HEIGHT,
      'wall',
    ).setTileScale(0.5)

    this.add.tileSprite(
      width / 2,
      (FLOOR_Y + HEIGHT) / 2,
      width,
      HEIGHT - FLOOR_Y,
      'floor',
    ).setTileScale(0.5)

    this.add.tileSprite(width / 2, FLOOR_Y, width, 8, 'baseboard').setTileScale(0.5)

    this.add.image(offset + SLOT_CENTERS[0], FLOOR_Y, 'desk').setOrigin(0.5, 1).setScale(0.5)
    this.add.image(offset + SLOT_CENTERS[0], FLOOR_Y - 73, 'monitor').setOrigin(0.5, 1).setScale(0.5)
    this.add.image(offset + SLOT_CENTERS[1], FLOOR_Y, 'bookshelf').setOrigin(0.5, 1).setScale(0.5)
    this.add.image(offset + SLOT_CENTERS[3], FLOOR_Y, 'returnTray').setOrigin(0.5, 1).setScale(0.5)

    this.add.rectangle(0, 0, width, STATUS_HEIGHT, 0x344b60).setOrigin(0, 0)
    this.add.image(width / 2, 0, 'statusBar').setOrigin(0.5, 0).setScale(0.5)

    this.shelfOrigin = {
      x: offset + SLOT_CENTERS[1] - SHELF_WIDTH / 2,
      y: FLOOR_Y - SHELF_HEIGHT,
    }
    this.bookImages = []
    this.storageText = this.add
      .text(offset + STORAGE_LABEL_RIGHT, STATUS_HEIGHT / 2, '', {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        color: '#e9d5b9',
      })
      .setOrigin(1, 0.5)
      .setResolution(2)
    const store = this.registry.get(GAME_STORE_KEY) as GameStore | undefined
    // 씬이 재시작(shutdown)되거나 게임째 파괴(destroy)될 때 모두 구독을 해제한다.
    // 해제하지 않으면 다른 화면에서 상태가 바뀔 때 죽은 씬이 그려 보려다 예외를 던진다.
    const cleanups: (() => void)[] = []
    if (store) {
      this.renderBooks(store.getState().library)
      cleanups.push(store.subscribe(() => this.renderBooks(store.getState().library)))
    }

    // 손님은 월드가 들고 있어 장면이 다시 만들어져도 이어진다. 시간은 이 장면의 update에서만 흐른다.
    this.visitorWorld = (this.registry.get(VISITOR_WORLD_KEY) as VisitorWorld | undefined) ?? null
    this.visitorImages = new Map()
    this.carriedBookImages = new Map()
    this.syncVisitors(this.time.now)
    cleanups.push(() => {
      this.visitorImages.forEach((image) => image.destroy())
      this.visitorImages.clear()
      this.carriedBookImages.forEach((image) => image.destroy())
      this.carriedBookImages.clear()
      this.visitorWorld = null
    })

    this.scale.on('resize', this.handleResize, this)
    const scale = this.scale
    cleanups.push(() => scale.off('resize', this.handleResize, this))

    const release = () => cleanups.splice(0).forEach((cleanup) => cleanup())
    this.events.once('shutdown', release)
    this.events.once('destroy', release)
  }

  update(time: number, delta: number) {
    if (!this.visitorWorld) return
    this.visitorWorld.tick(delta)
    this.syncVisitors(time)
  }

  /** 월드의 손님을 스프라이트에 반영한다. 걷는 동안만 흔들린다(걷기 프레임이 아니다). */
  private syncVisitors(time: number) {
    const world = this.visitorWorld
    if (!world) return
    const offset = (this.scale.width - BASE_WIDTH) / 2
    const alive = new Set<string>()
    const carriedIds = new Set<string>()
    for (const visitor of world.getVisitors()) {
      alive.add(visitor.id)
      if (visitor.book) carriedIds.add(visitor.id)
      let image = this.visitorImages.get(visitor.id)
      if (!image) {
        image = this.add.image(0, 0, 'visitor').setOrigin(0.5, 1).setScale(0.5)
        this.visitorImages.set(visitor.id, image)
      }
      const sway = isWalking(visitor) ? walkSway(time, visitorNumber(visitor.id)) : { lift: 0, angle: 0 }
      const x = offset + visitor.position.x
      const feetY = visitor.position.y - sway.lift
      image.setPosition(x, feetY).setAngle(sway.angle).setDepth(visitor.position.y)

      // 고른 도서는 퇴장할 때까지 머리 위에 보인다(대출 이후 표시 유지는 임시 결정).
      let carried = this.carriedBookImages.get(visitor.id)
      if (visitor.book && !carried) {
        carried = this.add.image(0, 0, `spine${spineVariant(visitor.book.bookId)}`).setOrigin(0.5, 1).setScale(0.5)
        this.carriedBookImages.set(visitor.id, carried)
      }
      if (carried) {
        carried.setPosition(x, feetY - VISITOR_HEIGHT - 2).setDepth(visitor.position.y + 1)
      }
    }
    const drop = <T extends Phaser.GameObjects.Image>(images: Map<string, T>, keep: (id: string) => boolean) => {
      images.forEach((image, id) => {
        if (keep(id)) return
        image.destroy()
        images.delete(id)
      })
    }
    drop(this.visitorImages, (id) => alive.has(id))
    drop(this.carriedBookImages, (id) => carriedIds.has(id))
  }

  private renderBooks(state: LibraryState) {
    this.storageText?.setText(storageLabel(storedCount(state)))
    this.bookImages.forEach((image) => image.destroy())
    this.bookImages = []
    state.shelf.forEach((book, slot) => {
      if (!book) return
      const { x, y } = slotPosition(slot)
      // 예약·대출 중이거나 반납 정리를 기다리는 도서는 슬롯을 지키는 반투명 쉐이프로 보인다.
      const available = bookStatus(state, book.id) === 'AVAILABLE'
      this.bookImages.push(
        this.add
          .image(this.shelfOrigin.x + x, this.shelfOrigin.y + y, `spine${spineVariant(book.id)}`)
          .setOrigin(0.5, 1)
          .setScale(0.5)
          .setAlpha(available ? 1 : 0.35),
      )
    })
  }

  private handleResize() {
    this.scene.restart()
  }
}
