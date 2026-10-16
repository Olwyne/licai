import nodemailer from "nodemailer"

// Envoi d'e-mails. Fournisseurs, par ordre de priorité :
//  1. Resend  — RESEND_API_KEY (+ MAIL_FROM)
//  2. SMTP    — SMTP_URL, ex. smtps://user:pass@smtp.exemple.fr:465 (+ MAIL_FROM)
//  3. repli   — le message est écrit dans les logs du serveur (développement)
export type MailProvider = "resend" | "smtp" | "log"

export const mailProvider = (): MailProvider =>
  process.env.RESEND_API_KEY ? "resend" : process.env.SMTP_URL ? "smtp" : "log"

const from = () => process.env.MAIL_FROM || "Lǐcái <no-reply@licai.localhost>"

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const provider = mailProvider()
  if (provider === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: from(), to: [to], subject, text }),
    })
    if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${await res.text()}`)
    return
  }
  if (provider === "smtp") {
    await nodemailer.createTransport(process.env.SMTP_URL!).sendMail({ from: from(), to, subject, text })
    return
  }
  console.log(`\n[mail:log] à ${to} — ${subject}\n${text}\n`)
}
