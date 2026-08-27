type Tone = "warning" | "info" | "danger" | "success" | "neutral"
interface Props { tone: Tone; children: React.ReactNode }

const TONE_CLS: Record<Tone, string> = {
  warning: "badge-warning",
  info: "badge-info",
  danger: "badge-danger",
  success: "badge-success",
  neutral: "badge-neutral",
}

export function Badge({ tone, children }: Props) {
  return <span className={`badge ${TONE_CLS[tone]}`}>{children}</span>
}
