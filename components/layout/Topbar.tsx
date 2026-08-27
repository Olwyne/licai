"use client"
interface Props { title: string; sub: string; action?: React.ReactNode }

export function Topbar({ title, sub, action }: Props) {
  return (
    <div className="topbar">
      <div>
        <h1 id="screen-title">{title}</h1>
        <div className="sub" id="screen-sub">{sub}</div>
      </div>
      {action && <div className="topbar-right">{action}</div>}
    </div>
  )
}
