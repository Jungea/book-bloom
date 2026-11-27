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
import { storedCount, type LibraryState } from '../core/library'
import type { GameStore } from '../reading/gameStore'
import { SHELF_HEIGHT, SHELF_WIDTH, slotPosition, spineVariant } from './shelfLayout'
import { storageLabel } from './statusLabels'

export const GAME_STORE_KEY = 'gameStore'

const SPINE_URLS = [spineBlueUrl, spineCreamUrl, spineGrayUrl, spineRedUrl, spineTaupeUrl]

const BASE_WIDTH = 640
const HEIGHT = 360
const STATUS_HEIGHT = 32
const FLOOR_Y = 240
const SLOT_CENTERS = [80, 240, 400, 560] as const
// 상태바 이미지 오른쪽에 있는 자리 표시 칸(논리 x 452~630)과 겹치지 않게 그 왼쪽 끝에 맞춘다.
const STORAGE_LABEL_RIGHT = 440

export class LibraryScene extends Phaser.Scene {
  private shelfOrigin = { x: 0, y: 0 }
  private bookImages: Phaser.GameObjects.Image[] = []
  private storageText: Phaser.GameObjects.Text | null = null

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

    this.scale.on('resize', this.handleResize, this)
    const scale = this.scale
    cleanups.push(() => scale.off('resize', this.handleResize, this))

    const release = () => cleanups.splice(0).forEach((cleanup) => cleanup())
    this.events.once('shutdown', release)
    this.events.once('destroy', release)
  }

  private renderBooks(state: LibraryState) {
    this.storageText?.setText(storageLabel(storedCount(state)))
    this.bookImages.forEach((image) => image.destroy())
    this.bookImages = []
    state.shelf.forEach((book, slot) => {
      if (!book) return
      const { x, y } = slotPosition(slot)
      this.bookImages.push(
        this.add
          .image(this.shelfOrigin.x + x, this.shelfOrigin.y + y, `spine${spineVariant(book.id)}`)
          .setOrigin(0.5, 1)
          .setScale(0.5),
      )
    })
  }

  private handleResize() {
    this.scene.restart()
  }
}
