import { ArrowLeft, Check, Pencil, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { actionIcon } from './actionIcons'
import { GENRES, type Genre } from './genres'
import { IconButton } from './IconButton'
import type { GameStore } from './gameStore'
import { editBook, registerBook, type Game, type Outcome, type RegisteredBook } from './reading'
import { bookActions, readingStatusLabel, rewardMessage, type BookAction } from './readingView'

interface ReadingScreenProps {
  store: GameStore
  onOpenLibrary: () => void
}

interface Feedback {
  readonly text: string
  readonly error: boolean
}

/**
 * 독서관리 임시 화면(세로형). 도서 등록·수정·삭제와 독서 상태 변경을 실제 독서 코어로 실행한다.
 * 레이아웃과 최종 디자인은 UI 상세 설계 전이라 정하지 않았다. 색은 화이트 + 슬레이트 테마로 확정했고,
 * 아이콘은 lucide-react를 쓴다: 뒤로 가기·수정·삭제·수정 취소처럼 뜻이 분명한 동작은 아이콘만(한국어 aria-label·툴팁),
 * 독서 상태 동작(`완독 취소`·`재독 시작` 등)과 등록·저장은 아이콘과 글자를 함께 보인다.
 */
export default function ReadingScreen({ store, onOpenLibrary }: ReadingScreenProps) {
  const game = useSyncExternalStore(store.subscribe, store.getState)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  // 코어가 거절한 동작은 상태를 바꾸지 않으므로 사유만 보여 준다.
  const run = (action: (current: Game) => Outcome): boolean => {
    const before = store.getState()
    const outcome = store.apply(action)
    if (!outcome.ok) {
      setFeedback({ text: outcome.reason, error: true })
      return false
    }
    const reward = rewardMessage(before, outcome.game)
    setFeedback(reward ? { text: reward, error: false } : null)
    return true
  }

  const perform = (action: BookAction) => {
    if (action.confirm && !window.confirm(action.confirm)) return
    run(action.run)
  }

  return (
    <section className="reading-screen" aria-label="독서 관리">
      <header className="reading-screen__header">
        <h1>독서 관리</h1>
        <IconButton
          icon={ArrowLeft}
          label="도서관으로 돌아가기"
          iconOnly
          className="reading-screen__switch"
          onClick={onOpenLibrary}
        />
      </header>

      <RegisterForm onRegister={(title, genre) => run((g) => registerBook(g, { title, genre }))} />

      {feedback && (
        <p
          className={`reading-screen__feedback${feedback.error ? ' reading-screen__feedback--error' : ''}`}
          role={feedback.error ? 'alert' : 'status'}
        >
          {feedback.text}
        </p>
      )}

      <h2 className="reading-screen__subtitle">내 도서 {game.reading.books.length}권</h2>
      {game.reading.books.length === 0 ? (
        <p className="reading-screen__empty">등록한 도서가 없습니다. 제목과 장르를 입력해 등록하세요.</p>
      ) : (
        <ul className="reading-screen__list">
          {game.reading.books.map((book) => (
            <BookRow key={book.id} game={game} book={book} onPerform={perform} onRun={run} />
          ))}
        </ul>
      )}
    </section>
  )
}

function RegisterForm({ onRegister }: { onRegister: (title: string, genre: string) => boolean }) {
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    // 등록에 성공했을 때만 입력을 비운다. 실패하면 입력을 남겨 고칠 수 있게 한다.
    if (onRegister(title, genre)) {
      setTitle('')
      setGenre('')
    }
  }

  return (
    <form className="reading-screen__form" onSubmit={submit}>
      <label>
        제목
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="도서 제목" />
      </label>
      <label>
        대표 장르
        <select value={genre} onChange={(e) => setGenre(e.target.value)}>
          <option value="">선택</option>
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>
      <IconButton type="submit" icon={Plus} label="도서 등록" />
    </form>
  )
}

interface BookRowProps {
  game: Game
  book: RegisteredBook
  onPerform: (action: BookAction) => void
  onRun: (action: (current: Game) => Outcome) => boolean
}

function BookRow({ game, book, onPerform, onRun }: BookRowProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(book.title)
  const [genre, setGenre] = useState<Genre>(book.genre)
  const editButton = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(false)

  // 키보드 조작: 수정 폼이 열리면 수정 버튼이 사라져 포커스를 잃으므로, 열 때는 제목 입력칸이 포커스를 받고(autoFocus)
  // 저장하거나 취소해 닫으면 포커스를 수정 버튼으로 돌려 보낸다.
  useEffect(() => {
    if (wasEditing.current && !editing) editButton.current?.focus()
    wasEditing.current = editing
  }, [editing])

  const startEditing = () => {
    setTitle(book.title)
    setGenre(book.genre)
    setEditing(true)
  }

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (onRun((g) => editBook(g, book.id, { title, genre }))) setEditing(false)
  }

  if (editing) {
    return (
      <li className="reading-screen__book">
        <form className="reading-screen__form" onSubmit={save}>
          <label>
            제목
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            대표 장르
            <select value={genre} onChange={(e) => setGenre(e.target.value as Genre)}>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <span className="reading-screen__actions">
            <IconButton type="submit" icon={Check} label="저장" />
            <IconButton
              icon={X}
              label="수정 취소"
              accessibleName={`${book.title} 수정 취소`}
              iconOnly
              onClick={() => setEditing(false)}
            />
          </span>
        </form>
      </li>
    )
  }

  return (
    <li className="reading-screen__book">
      <div>
        <strong className="reading-screen__book-title">{book.title}</strong>
        <span className="reading-screen__book-meta">
          {book.genre} · {readingStatusLabel(game, book.id)}
        </span>
      </div>
      <span className="reading-screen__actions">
        {bookActions(game, book.id).map((action) => {
          const mapped = actionIcon(action.label)
          const className = action.danger ? 'reading-screen__danger' : undefined
          // 짝이 되는 아이콘이 없는 동작은 글자만 있는 버튼으로 둔다.
          if (!mapped) {
            return (
              <button key={action.label} type="button" className={className} onClick={() => onPerform(action)}>
                {action.label}
              </button>
            )
          }
          return (
            <IconButton
              key={action.label}
              icon={mapped.icon}
              label={action.label}
              iconOnly={mapped.iconOnly}
              accessibleName={mapped.iconOnly ? `${book.title} ${action.label}` : undefined}
              className={className}
              onClick={() => onPerform(action)}
            />
          )
        })}
        <IconButton
          ref={editButton}
          icon={Pencil}
          label="수정"
          accessibleName={`${book.title} 수정`}
          iconOnly
          onClick={startEditing}
        />
      </span>
    </li>
  )
}
