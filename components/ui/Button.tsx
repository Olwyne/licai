import { ButtonHTMLAttributes } from "react"
import { clsx } from "clsx"

type Variant = "primary" | "ghost" | "danger"
type Size = "sm" | "md"

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({ variant = "primary", size = "md", className, ...props }: Props) {
  return (
    <button
      className={clsx(
        "btn",
        variant === "primary" && "btn-primary",
        variant === "ghost" && "btn-ghost",
        variant === "danger" && "btn-danger",
        size === "sm" && "btn-sm",
        className
      )}
      {...props}
    />
  )
}
