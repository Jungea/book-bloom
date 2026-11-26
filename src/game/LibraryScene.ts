import Phaser from 'phaser'
import wallUrl from '../../assets/source/v4/backgrounds/wall_tile.png'
import floorUrl from '../../assets/source/v4/backgrounds/floor_tile.png'
import baseboardUrl from '../../assets/source/v4/backgrounds/baseboard_tile.png'
import statusBarUrl from '../../assets/source/v4/ui/status_bar.png'
import deskUrl from '../../assets/source/v4/circulation/circulation_desk.png'
import monitorUrl from '../../assets/source/v4/circulation/desk_monitor.png'
import bookshelfUrl from '../../assets/source/v4/bookshelves/bookshelf_empty.png'
import returnTrayUrl from '../../assets/source/v4/circulation/return_tray_empty.png'

const WIDTH = 640
const HEIGHT = 360
const STATUS_HEIGHT = 32
const FLOOR_Y = 240
const SLOT_CENTERS = [80, 240, 400, 560] as const

export class LibraryScene extends Phaser.Scene {
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
  }

  create() {
    this.add.tileSprite(
      WIDTH / 2,
      (STATUS_HEIGHT + FLOOR_Y) / 2,
      WIDTH,
      FLOOR_Y - STATUS_HEIGHT,
      'wall',
    ).setTileScale(0.5)

    this.add.tileSprite(
      WIDTH / 2,
      (FLOOR_Y + HEIGHT) / 2,
      WIDTH,
      HEIGHT - FLOOR_Y,
      'floor',
    ).setTileScale(0.5)

    this.add.tileSprite(WIDTH / 2, FLOOR_Y, WIDTH, 8, 'baseboard').setTileScale(0.5)

    this.add.image(SLOT_CENTERS[0], FLOOR_Y, 'desk').setOrigin(0.5, 1).setScale(0.5)
    this.add.image(SLOT_CENTERS[0], FLOOR_Y - 76, 'monitor').setOrigin(0.5, 1).setScale(0.5)
    this.add.image(SLOT_CENTERS[1], FLOOR_Y, 'bookshelf').setOrigin(0.5, 1).setScale(0.5)
    this.add.image(SLOT_CENTERS[3], FLOOR_Y, 'returnTray').setOrigin(0.5, 1).setScale(0.5)

    this.add.image(WIDTH / 2, 0, 'statusBar').setOrigin(0.5, 0).setDisplaySize(WIDTH, STATUS_HEIGHT)
  }
}
