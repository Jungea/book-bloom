import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { LibraryScene } from './game/LibraryScene'

export function App() {
  const canvasHost = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!canvasHost.current) return

    const host = canvasHost.current
    const logicalWidth = () => Math.max(640, Math.round(360 * host.clientWidth / host.clientHeight))
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      width: logicalWidth(),
      height: 360,
      backgroundColor: '#e9d5b9',
      pixelArt: true,
      roundPixels: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [LibraryScene],
    })

    const observer = new ResizeObserver(() => {
      const width = logicalWidth()
      if (game.scale.width !== width) game.scale.resize(width, 360)
    })
    observer.observe(host)

    return () => {
      observer.disconnect()
      game.destroy(true)
    }
  }, [])

  return (
    <main className="page">
      <h1 className="sr-only">북블룸 도서관</h1>
      <div className="game-frame" ref={canvasHost} aria-label="북블룸 도서관 초기 화면" />
    </main>
  )
}
