import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { LibraryScene } from './game/LibraryScene'

export function App() {
  const canvasHost = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!canvasHost.current) return

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: canvasHost.current,
      width: 640,
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

    return () => game.destroy(true)
  }, [])

  return (
    <main className="page">
      <h1 className="sr-only">북블룸 도서관</h1>
      <div className="game-frame" ref={canvasHost} aria-label="북블룸 도서관 초기 화면" />
    </main>
  )
}
