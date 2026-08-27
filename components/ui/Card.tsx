interface Props { className?: string; children: React.ReactNode }

export function Card({ className, children }: Props) {
  return <div className={`card ${className ?? ""}`}>{children}</div>
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="card-header">{children}</div>
}
