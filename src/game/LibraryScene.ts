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
import { BASE_WIDTH, FLOOR_Y, HEIGHT, SLOT_CENTERS, STATUS_HEIGHT, spriteFilterFor } from './sceneLayout'
import { storageCountText } from './statusLabels'
import { CANVAS_ICON_GRID, drawPackageIcon, drawBookDownIcon } from './canvasIcons'
import { trayDisplay } from './trayDisplay'
import { RING_RADIUS, drawRingCanvas, ringTextureSize } from './ringCanvas'
import { CLOTHES_COLORS, HAIR_COLORS, recolorVisitorPixels, visitorLook, visitorTextureKey } from './visitorLook'
import { carriedBookPlacement } from './carriedBook'
import { UI_FONT_FAMILY, UI_FONT_WEIGHT } from '../uiFont'
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

// 보관함 아이콘(20px)과 그 오른쪽 숫자. 상태바 이미지 오른쪽의 자리 표시 칸(논리 x 452~630)과 겹치지 않도록,
// 숫자가 세 자리여도 그 칸을 넘지 않는 위치에 둔다.
const STORAGE_ICON_X = 400
const STORAGE_ICON_SIZE = 20
const STORAGE_ICON_GAP = 4
const STORAGE_COLOR = 0xe9d5b9
// 반납 트레이(논리 높이 64) 위에 쌓인 책을 얹는 높이와 반납 대기 아이콘(20px, 권수는 표시하지 않는다)의 아래 끝 높이.
// 화면을 보며 맞춘 임시 값이다.
const TRAY_BOOKS_LIFT = 44
const TRAY_ICON_LIFT = 70
const TRAY_ICON_SIZE = 20
const TRAY_ICON_COLOR = 0x3a2a1a
// 아이콘을 눌러도 반납 정리가 시작된다(눌리는 영역은 아이콘 사방으로 이만큼(논리 px) 넓다). 반납 책이 쌓여 있는 동안은 깜빡인다.
const TRAY_ICON_HIT_PAD = 8
const TRAY_BLINK_MS = 500
const TRAY_BLINK_MIN_ALPHA = 0.2
// 원형 진행률 링: 크기와 위치는 임시 값이다(최종 UI 미정). 트레이 링은 트레이 아이콘 왼쪽에 둔다.
// 링은 캔버스 2D 텍스처로 그린다(`ringCanvas.ts`).
interface RingSlot {
  key: string
  image: Phaser.GameObjects.Image
  texture: Phaser.Textures.CanvasTexture
  /** 텍스처에 마지막으로 그린 진행률(아직 그리지 않았으면 NaN). */
  progress: number
}
const TRAY_RING_OFFSET = { x: -(TRAY_ICON_SIZE / 2 + RING_RADIUS + 5), y: -(TRAY_ICON_LIFT + TRAY_ICON_SIZE / 2) }
// 데스크 링은 머리 위에 눕혀 얹은 책 바로 위, 손님 가운데에 둔다(책과 겹치지 않게 책의 최대 두께만큼 띄운다).
const DESK_RING_OFFSET = { x: 0, y: -(VISITOR_HEAD_TOP + CARRIED_BOOK_MAX_THICKNESS + RING_RADIUS + 4) }

/** 손님 id(`visitor-12`)의 번호. 흔들림의 위상을 손님마다 다르게 하는 데 쓴다. */
function visitorNumber(id: string): number {
  return Number(id.split('-')[1]) || 0
}

export class LibraryScene extends Phaser.Scene {
  /** 캔버스 해상도 배율(캔버스 높이 / 논리 높이 360)과 그에 따른 논리 너비. create()에서 정한다. */
  private renderZoom = 1
  private logicalWidth = BASE_WIDTH
  private shelfOrigin = { x: 0, y: 0 }
  private bookImages: Phaser.GameObjects.Image[] = []
  private storageText: Phaser.GameObjects.Text | null = null
  private trayBooks: Phaser.GameObjects.Image | null = null
  private trayIcon: Phaser.GameObjects.Graphics | null = null
  private trayBlink: Phaser.Tweens.Tween | null = null
  private visitorWorld: VisitorWorld | null = null
  private sorter: ReturnSorter | null = null
  private ringSlots: RingSlot[] = []
  /** 스프라이트 텍스처 필터(배율에 따라 정해진다). 나중에 만드는 손님 변형 텍스처에도 같게 쓴다. */
  private spriteFilter: Phaser.Textures.FilterMode = Phaser.Textures.FilterMode.NEAREST
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
    // 캔버스는 기기 화면 픽셀에 맞춰 논리 크기(360 높이)의 zoom배로 만들어진다(App.tsx). 장면 좌표는 논리 좌표를 그대로 쓰고
    // 카메라 줌이 이를 캔버스 픽셀로 옮긴다. 글자는 같은 배율로 그려 또렷하게 하고, 링은 카메라를 거쳐 그대로 또렷해진다.
    this.renderZoom = this.scale.height / HEIGHT
    this.logicalWidth = this.scale.width / this.renderZoom
    const width = this.logicalWidth
    const offset = (width - BASE_WIDTH) / 2
    this.cameras.main.setZoom(this.renderZoom).centerOn(width / 2, HEIGHT / 2)
    this.spriteFilter =
      spriteFilterFor(this.renderZoom) === 'linear' ? Phaser.Textures.FilterMode.LINEAR : Phaser.Textures.FilterMode.NEAREST
    this.textures.getTextureKeys().forEach((key) => {
      if (key.startsWith('__')) return
      this.textures.get(key).setFilter(this.spriteFilter)
    })

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
    // 정리 전 반납 도서가 있으면 트레이 위에 쌓인 책과 트레이 아이콘을 얹는다(권수는 표시하지 않는다, 임시 표시).
    this.trayBooks = this.add
      .image(offset + SLOT_CENTERS[3], FLOOR_Y - TRAY_BOOKS_LIFT, 'returnedBooks')
      .setOrigin(0.5, 1)
      .setScale(0.5)
      .setVisible(false)
    this.trayIcon = this.add
      .graphics()
      .setPosition(offset + SLOT_CENTERS[3] - TRAY_ICON_SIZE / 2, FLOOR_Y - TRAY_ICON_LIFT - TRAY_ICON_SIZE)
      .setScale(TRAY_ICON_SIZE / CANVAS_ICON_GRID)
      .setVisible(false)
    drawBookDownIcon(this.trayIcon, TRAY_ICON_COLOR)
    // 아이콘을 눌러도 트레이를 누른 것과 같이 반납 정리가 시작된다. 누르기 쉽도록 눌리는 영역은 보이는 크기보다 사방으로 넓힌다
    // (영역은 아이콘의 24 격자 좌표). 보이지 않을 때는 눌리지 않는다.
    const hitPad = (TRAY_ICON_HIT_PAD * CANVAS_ICON_GRID) / TRAY_ICON_SIZE
    this.trayIcon
      .setInteractive(
        new Phaser.Geom.Rectangle(-hitPad, -hitPad, CANVAS_ICON_GRID + 2 * hitPad, CANVAS_ICON_GRID + 2 * hitPad),
        Phaser.Geom.Rectangle.Contains,
      )
      .on('pointerdown', () => {
        this.sorter?.click()
      })
    if (this.trayIcon.input) this.trayIcon.input.cursor = 'pointer'
    this.trayBlink = null

    this.add.rectangle(0, 0, width, STATUS_HEIGHT, 0x344b60).setOrigin(0, 0)
    this.add.image(width / 2, 0, 'statusBar').setOrigin(0.5, 0).setScale(0.5)

    this.shelfOrigin = {
      x: offset + SLOT_CENTERS[1] - SHELF_WIDTH / 2,
      y: FLOOR_Y - SHELF_HEIGHT,
    }
    this.bookImages = []
    // 보관함은 글자 대신 아이콘과 숫자로 표시한다(왼쪽 위 기준으로 놓고 숫자는 아이콘 오른쪽에서 시작한다).
    const storageIcon = this.add
      .graphics()
      .setPosition(offset + STORAGE_ICON_X, (STATUS_HEIGHT - STORAGE_ICON_SIZE) / 2)
      .setScale(STORAGE_ICON_SIZE / CANVAS_ICON_GRID)
    drawPackageIcon(storageIcon, STORAGE_COLOR)
    this.storageText = this.add
      .text(offset + STORAGE_ICON_X + STORAGE_ICON_SIZE + STORAGE_ICON_GAP, STATUS_HEIGHT / 2, '', {
        fontFamily: UI_FONT_FAMILY,
        fontStyle: UI_FONT_WEIGHT,
        fontSize: '11px',
        color: '#e9d5b9',
      })
      .setOrigin(0, 0.5)
      .setResolution(this.renderZoom)
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
    this.ringSlots = []
    this.flyingBooks = new Set()
    if (this.sorter && store) {
      cleanups.push(this.sorter.onSorted((bookId) => this.flyBook(bookId, store, offset)))
    }
    cleanups.push(() => {
      this.flyingBooks.forEach((image) => image.destroy())
      this.flyingBooks.clear()
      this.ringSlots.forEach((slot) => {
        slot.image.destroy()
        this.textures.remove(slot.key)
      })
      this.ringSlots = []
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
    const offset = (this.logicalWidth - BASE_WIDTH) / 2
    let used = 0
    const ring = (x: number, y: number, progress: number) => {
      const slot = this.ringSlot(used++)
      slot.image.setPosition(x, y).setVisible(true)
      // 같은 진행률이면 텍스처를 다시 그리지 않는다(위치만 갱신).
      if (slot.progress !== progress) {
        const size = ringTextureSize(this.renderZoom)
        drawRingCanvas(slot.texture.getContext(), size, this.renderZoom, progress)
        slot.texture.refresh()
        slot.progress = progress
      }
    }

    if (this.sorter?.isActive()) {
      ring(offset + SLOT_CENTERS[3] + TRAY_RING_OFFSET.x, FLOOR_Y + TRAY_RING_OFFSET.y, this.sorter.getProgress())
    }
    for (const visitor of this.visitorWorld?.getVisitors() ?? []) {
      if (visitor.phase !== 'CHECKOUT' || visitor.pending) continue
      const progress = 1 - visitor.checkoutLeftMs / VISITOR_CONFIG.checkoutMs
      ring(offset + visitor.position.x + DESK_RING_OFFSET.x, visitor.position.y + DESK_RING_OFFSET.y, progress)
    }
    for (let i = used; i < this.ringSlots.length; i++) this.ringSlots[i].image.setVisible(false)
  }

  /**
   * 링 하나를 그리는 슬롯(캔버스 텍스처 + 이미지). 필요할 때 만든다.
   * 텍스처는 기기 해상도로 만들고 이미지는 카메라 줌의 역수로 놓아 화면 픽셀과 1:1로 보인다.
   */
  private ringSlot(index: number): RingSlot {
    const existing = this.ringSlots[index]
    if (existing) return existing
    const key = `ring-${index}`
    if (this.textures.exists(key)) this.textures.remove(key)
    const size = ringTextureSize(this.renderZoom)
    const texture = this.textures.createCanvas(key, size, size)
    if (!texture) throw new Error('링 텍스처를 만들지 못했습니다.')
    const image = this.add.image(0, 0, key).setScale(1 / this.renderZoom).setDepth(2000).setVisible(false)
    const slot: RingSlot = { key, image, texture, progress: Number.NaN }
    this.ringSlots[index] = slot
    return slot
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

  /**
   * 손님 번호에 맞는 머리색·옷색 변형 텍스처의 이름을 돌려준다. 없으면 원본 스프라이트에서 두 색만 바꿔 만든다
   * (머리 모양·피부색·신발은 그대로). 만든 텍스처는 게임이 끝날 때까지 재사용한다.
   */
  private visitorTexture(visitorNum: number): string {
    const look = visitorLook(visitorNum)
    const key = visitorTextureKey(look)
    if (this.textures.exists(key)) return key
    const source = this.textures.get('visitor').getSourceImage() as CanvasImageSource & { width: number; height: number }
    const texture = this.textures.createCanvas(key, source.width, source.height)
    if (!texture) return 'visitor'
    const ctx = texture.getContext()
    ctx.drawImage(source, 0, 0)
    const pixels = ctx.getImageData(0, 0, source.width, source.height)
    recolorVisitorPixels(pixels.data, HAIR_COLORS[look.hair], CLOTHES_COLORS[look.clothes])
    ctx.putImageData(pixels, 0, 0)
    texture.refresh()
    texture.setFilter(this.spriteFilter)
    return key
  }

  /** 월드의 손님을 스프라이트에 반영한다. 걷는 동안만 흔들린다(걷기 프레임이 아니다). */
  private syncVisitors(time: number) {
    const world = this.visitorWorld
    if (!world) return
    const offset = (this.logicalWidth - BASE_WIDTH) / 2
    const alive = new Set<string>()
    const carriedIds = new Set<string>()
    for (const visitor of world.getVisitors()) {
      alive.add(visitor.id)
      if (visitor.book) carriedIds.add(visitor.id)
      let image = this.visitorImages.get(visitor.id)
      if (!image) {
        image = this.add.image(0, 0, this.visitorTexture(visitorNumber(visitor.id))).setOrigin(0.5, 1).setScale(0.5)
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

  /** 반납 책이 쌓여 있는 동안 트레이 아이콘이 깜빡인다. 없어지면 멈추고 원래 투명도로 돌린다. */
  private setTrayBlink(on: boolean) {
    const icon = this.trayIcon
    if (!icon) return
    if (on) {
      if (this.trayBlink) return
      this.trayBlink = this.tweens.add({
        targets: icon,
        alpha: { from: 1, to: TRAY_BLINK_MIN_ALPHA },
        duration: TRAY_BLINK_MS,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      })
      return
    }
    this.trayBlink?.remove()
    this.trayBlink = null
    icon.setAlpha(1)
  }

  private renderBooks(state: LibraryState) {
    this.storageText?.setText(storageCountText(storedCount(state)))
    const tray = trayDisplay(returnedCount(state))
    this.trayBooks?.setVisible(tray.showBooks)
    this.trayIcon?.setVisible(tray.showBooks)
    this.setTrayBlink(tray.showBooks)
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
