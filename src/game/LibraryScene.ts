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
import type { LibraryState } from '../core/library'
import type { LibraryStore } from '../core/libraryStore'
import { SHELF_HEIGHT, SHELF_WIDTH, slotPosition, spineVariant } from './shelfLayout'

export const LIBRARY_STORE_KEY = 'libraryStore'

const SPINE_URLS = [spineBlueUrl, spineCreamUrl, spineGrayUrl, spineRedUrl, spineTaupeUrl]

const BASE_WIDTH = 640
const HEIGHT = 360
const STATUS_HEIGHT = 32
const FLOOR_Y = 240
const SLOT_CENTERS = [80, 240, 400, 560] as const

export class LibraryScene extends Phaser.Scene {
  private shelfOrigin = { x: 0, y: 0 }
  private bookImages: Phaser.GameObjects.Image[] = []

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
    this.add.image(offset + SLOT_CENTERS[0], FLOOR_Y - 76, 'monitor').setOrigin(0.5, 1).setScale(0.5)
    this.add.image(offset + SLOT_CENTERS[1], FLOOR_Y, 'bookshelf').setOrigin(0.5, 1).setScale(0.5)
    this.add.image(offset + SLOT_CENTERS[3], FLOOR_Y, 'returnTray').setOrigin(0.5, 1).setScale(0.5)

    this.add.rectangle(0, 0, width, STATUS_HEIGHT, 0x344b60).setOrigin(0, 0)
    this.add.image(width / 2, 0, 'statusBar').setOrigin(0.5, 0).setScale(0.5)

    this.shelfOrigin = {
      x: offset + SLOT_CENTERS[1] - SHELF_WIDTH / 2,
      y: FLOOR_Y - SHELF_HEIGHT,
    }
    this.bookImages = []
    const store = this.registry.get(LIBRARY_STORE_KEY) as LibraryStore | undefined
    if (store) {
      this.renderBooks(store.getState())
      const unsubscribe = store.subscribe(() => this.renderBooks(store.getState()))
      this.events.once('shutdown', unsubscribe)
    }

    this.scale.on('resize', this.handleResize, this)
    this.events.once('shutdown', () => this.scale.off('resize', this.handleResize, this))
  }

  private renderBooks(state: LibraryState) {
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
