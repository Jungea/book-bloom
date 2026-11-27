import Phaser from 'phaser'
import wallUrl from '../../assets/source/v4/backgrounds/wall_tile.png'
import floorUrl from '../../assets/source/v4/backgrounds/floor_tile.png'
import baseboardUrl from '../../assets/source/v4/backgrounds/baseboard_tile.png'
import statusBarUrl from '../../assets/source/v4/ui/status_bar.png'
import deskUrl from '../../assets/source/v4/circulation/circulation_desk.png'
import monitorUrl from '../../assets/source/v4/circulation/desk_monitor.png'
import bookshelfUrl from '../../assets/source/v4/bookshelves/bookshelf_empty.png'
import returnTrayUrl from '../../assets/source/v4/circulation/return_tray_empty.png'
import returnedBooksUrl from '../../assets/source/v4/circulation/returned_books.png'
import spineBlueUrl from '../../assets/source/v4/books/book_spine_blue.png'
import spineCreamUrl from '../../assets/source/v4/books/book_spine_cream.png'
import spineGrayUrl from '../../assets/source/v4/books/book_spine_gray.png'
import spineRedUrl from '../../assets/source/v4/books/book_spine_red.png'
import spineTaupeUrl from '../../assets/source/v4/books/book_spine_taupe.png'
import visitorUrl from '../../assets/source/v4/characters/visitor_idle.png'
import { bookStatus, returnedCount } from '../core/circulation'
import { storedCount, type LibraryState } from '../core/library'
import { isWalking } from '../core/visitors'
import type { ReturnSorter } from '../core/returnSorter'
import type { VisitorWorld } from '../core/visitorWorld'
import type { GameStore } from '../reading/gameStore'
import { SHELF_HEIGHT, SHELF_WIDTH, slotPosition, spineVariant } from './shelfLayout'
import { BASE_WIDTH, FLOOR_Y, HEIGHT, SLOT_CENTERS, STATUS_HEIGHT } from './sceneLayout'
import { storageLabel } from './statusLabels'
import { trayDisplay } from './trayDisplay'
import { ringArc } from './progressRing'
import { carriedBookPlacement } from './carriedBook'
import {
  CARRIED_BOOK_MAX_THICKNESS,
  TEMP_SORT_FLIGHT_MS,
  VISITOR_CONFIG,
  VISITOR_HEAD_TOP,
  walkSway,
} from './visitorLayout'

export const GAME_STORE_KEY = 'gameStore'
export const VISITOR_WORLD_KEY = 'visitorWorld'
export const SORTER_KEY = 'returnSorter'

const SPINE_URLS = [spineBlueUrl, spineCreamUrl, spineGrayUrl, spineRedUrl, spineTaupeUrl]

// 상태바 이미지 오른쪽에 있는 자리 표시 칸(논리 x 452~630)과 겹치지 않게 그 왼쪽 끝에 맞춘다.
const STORAGE_LABEL_RIGHT = 440
// 반납 트레이(논리 높이 64) 위에 쌓인 책을 얹는 높이와 권수 문구의 높이. 화면을 보며 맞춘 임시 값이다.
const TRAY_BOOKS_LIFT = 44
const TRAY_LABEL_LIFT = 70
// 원형 진행률 링: 크기와 위치는 임시 값이다(최종 UI 미정). 트레이 링은 `반납 N권` 문구 왼쪽에 둔다.
const RING_RADIUS = 7
const TRAY_RING_OFFSET = { x: -40, y: -76 }
// 데스크 링은 머리 위에 눕혀 얹은 책 바로 위, 손님 가운데에 둔다(책과 겹치지 않게 책의 최대 두께만큼 띄운다).
const DESK_RING_OFFSET = { x: 0, y: -(VISITOR_HEAD_TOP + CARRIED_BOOK_MAX_THICKNESS + RING_RADIUS + 3) }

/** 손님 id(`visitor-12`)의 번호. 흔들림의 위상을 손님마다 다르게 하는 데 쓴다. */
function visitorNumber(id: string): number {
  return Number(id.split('-')[1]) || 0
}

export class LibraryScene extends Phaser.Scene {
  private shelfOrigin = { x: 0, y: 0 }
  private bookImages: Phaser.GameObjects.Image[] = []
  private storageText: Phaser.GameObjects.Text | null = null
  private trayBooks: Phaser.GameObjects.Image | null = null
  private trayText: Phaser.GameObjects.Text | null = null
  private visitorWorld: VisitorWorld | null = null
  private sorter: ReturnSorter | null = null
  private rings: Phaser.GameObjects.Graphics | null = null
  private flyingBooks = new Set<Phaser.GameObjects.Image>()
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
    this.load.image('returnedBooks', returnedBooksUrl)
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

    // 데스크를 클릭하면 처리 중인 대출이 즉시 완료된다. 클릭 영역은 이미지 전체(임시)이며 마우스·터치가 같은 포인터 이벤트다.
    this.add
      .image(offset + SLOT_CENTERS[0], FLOOR_Y, 'desk')
      .setOrigin(0.5, 1)
      .setScale(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.visitorWorld?.completeCheckout()
      })
    this.add.image(offset + SLOT_CENTERS[0], FLOOR_Y - 73, 'monitor').setOrigin(0.5, 1).setScale(0.5)
    this.add.image(offset + SLOT_CENTERS[1], FLOOR_Y, 'bookshelf').setOrigin(0.5, 1).setScale(0.5)
    // 트레이를 클릭하면 반납 도서 정리가 시작되고, 정리 중 다시 클릭하면 처리 중인 한 권이 즉시 돌아간다.
    this.add
      .image(offset + SLOT_CENTERS[3], FLOOR_Y, 'returnTray')
      .setOrigin(0.5, 1)
      .setScale(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.sorter?.click()
      })
    // 정리 전 반납 도서가 있으면 트레이 위에 쌓인 책과 권수를 얹는다(임시 표시, 위치는 화면을 보며 맞춘다).
    this.trayBooks = this.add
      .image(offset + SLOT_CENTERS[3], FLOOR_Y - TRAY_BOOKS_LIFT, 'returnedBooks')
      .setOrigin(0.5, 1)
      .setScale(0.5)
      .setVisible(false)
    this.trayText = this.add
      .text(offset + SLOT_CENTERS[3], FLOOR_Y - TRAY_LABEL_LIFT, '', {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        color: '#3a2a1a',
      })
      .setOrigin(0.5, 1)
      .setResolution(2)

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

    // 트레이 정리 진행은 이 장면의 update에서만 흐른다(독서 관리 중에는 멈춘다, 임시 동작).
    this.sorter = (this.registry.get(SORTER_KEY) as ReturnSorter | undefined) ?? null
    this.rings = this.add.graphics().setDepth(2000)
    this.flyingBooks = new Set()
    if (this.sorter && store) {
      cleanups.push(this.sorter.onSorted((bookId) => this.flyBook(bookId, store, offset)))
    }
    cleanups.push(() => {
      this.flyingBooks.forEach((image) => image.destroy())
      this.flyingBooks.clear()
      this.rings = null
      this.sorter = null
    })

    this.scale.on('resize', this.handleResize, this)
    const scale = this.scale
    cleanups.push(() => scale.off('resize', this.handleResize, this))

    const release = () => cleanups.splice(0).forEach((cleanup) => cleanup())
    this.events.once('shutdown', release)
    this.events.once('destroy', release)
  }

  update(time: number, delta: number) {
    this.sorter?.tick(delta)
    if (this.visitorWorld) {
      this.visitorWorld.tick(delta)
      this.syncVisitors(time)
    }
    this.drawRings()
  }

  /** 원형 진행률을 그린다: 트레이 정리, 데스크 대출 처리. */
  private drawRings() {
    const graphics = this.rings
    if (!graphics) return
    graphics.clear()
    const offset = (this.scale.width - BASE_WIDTH) / 2
    const ring = (x: number, y: number, progress: number) => {
      graphics.lineStyle(2, 0x3a2a1a, 0.35)
      graphics.strokeCircle(x, y, RING_RADIUS)
      const arc = ringArc(progress)
      graphics.lineStyle(2, 0xd9a441, 1)
      graphics.beginPath()
      graphics.arc(x, y, RING_RADIUS, arc.start, arc.end, false)
      graphics.strokePath()
    }

    if (this.sorter?.isActive()) {
      ring(offset + SLOT_CENTERS[3] + TRAY_RING_OFFSET.x, FLOOR_Y + TRAY_RING_OFFSET.y, this.sorter.getProgress())
    }
    for (const visitor of this.visitorWorld?.getVisitors() ?? []) {
      if (visitor.phase !== 'CHECKOUT' || visitor.pending) continue
      const progress = 1 - visitor.checkoutLeftMs / VISITOR_CONFIG.checkoutMs
      ring(offset + visitor.position.x + DESK_RING_OFFSET.x, visitor.position.y + DESK_RING_OFFSET.y, progress)
    }
  }

  /** 정리된 책이 트레이에서 책장 원래 자리로 날아가는 시각 효과. 상태는 정리 시점에 이미 바뀌어 있다. */
  private flyBook(bookId: string, store: GameStore, offset: number) {
    const slot = store.getState().library.shelf.findIndex((book) => book?.id === bookId)
    if (slot === -1) return
    const target = slotPosition(slot)
    const image = this.add
      .image(offset + SLOT_CENTERS[3], FLOOR_Y - TRAY_BOOKS_LIFT, `spine${spineVariant(bookId)}`)
      .setOrigin(0.5, 1)
      .setScale(0.5)
      .setDepth(1500)
    this.flyingBooks.add(image)
    this.tweens.add({
      targets: image,
      x: this.shelfOrigin.x + target.x,
      y: this.shelfOrigin.y + target.y,
      duration: TEMP_SORT_FLIGHT_MS,
      onComplete: () => {
        this.flyingBooks.delete(image)
        image.destroy()
      },
    })
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

      // 고른 도서는 퇴장할 때까지 머리 위에 가로로 눕혀 얹힌 모습으로 보인다(대출 이후 표시 유지는 임시 결정).
      // 예약 후 이동·대기·대출 완료 후 퇴장 모두 같은 방향이며, 손님이 흔들리면 책도 같은 각도로 함께 기운다.
      let carried = this.carriedBookImages.get(visitor.id)
      if (visitor.book && !carried) {
        carried = this.add.image(0, 0, `spine${spineVariant(visitor.book.bookId)}`).setOrigin(0.5, 0.5).setScale(0.5)
        this.carriedBookImages.set(visitor.id, carried)
      }
      if (carried) {
        const placement = carriedBookPlacement({ x, y: feetY }, sway.angle, carried.displayWidth)
        carried.setPosition(placement.x, placement.y).setAngle(placement.angle).setDepth(visitor.position.y + 1)
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
    const tray = trayDisplay(returnedCount(state))
    this.trayBooks?.setVisible(tray.showBooks)
    this.trayText?.setText(tray.label ?? '')
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
