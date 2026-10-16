// Envoi d'e-mails. Aucun serveur SMTP n'est configuré par défaut : le message est alors écrit dans les logs du serveur.
// Pour brancher un vrai envoi, remplacer le corps de sendMail (Resend, SMTP…).
export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  console.log(`\n[mail] à ${to} — ${subject}\n${text}\n`)
}
