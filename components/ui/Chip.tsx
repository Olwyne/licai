interface Props {
  active?: boolean
  onClick?: () => void
  children: React.ReactNode
}

export function Chip({ active, onClick, children }: Props) {
  return (
    <button
      className={`chip ${active ? "active" : ""}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}
