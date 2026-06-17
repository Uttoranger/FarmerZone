import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = 'Bauernshop <noreply@bauernshop.at>'

type SendEmailParams = {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  if (!resend) {
    console.log(`[E-Mail würde gesendet werden an ${to}] Betreff: ${subject}`)
    return
  }
  await resend.emails.send({ from: FROM, to, subject, html })
}

export function orderConfirmationHtml(p: {
  customerName: string
  orderNumber: string
  farmName: string
  pickupDate: string
  pickupTime: string
  items: Array<{ name: string; quantity: number; unitPrice: number }>
  total: number
  isOnline: boolean
}): string {
  const rows = p.items
    .map(
      (i) =>
        `<tr><td style="padding:4px 8px">${i.name}</td><td style="padding:4px 8px;text-align:center">${i.quantity}×</td><td style="padding:4px 8px;text-align:right">€ ${i.unitPrice.toFixed(2)}</td></tr>`
    )
    .join('')
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="color:#15803d;margin-bottom:8px">Bestellbestätigung ✓</h1>
  <p>Hallo <strong>${p.customerName}</strong>,</p>
  <p>deine Bestellung <strong>${p.orderNumber}</strong> bei <strong>${p.farmName}</strong> wurde ${p.isOnline ? 'erfolgreich bezahlt' : 'bestätigt'}.</p>
  <h3 style="margin-bottom:4px">📅 Abholtermin</h3>
  <p style="margin-top:0">${p.pickupDate} &nbsp;|&nbsp; ${p.pickupTime} Uhr</p>
  <h3 style="margin-bottom:4px">Bestellübersicht</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <thead><tr style="background:#f1f5f9"><th align="left" style="padding:6px 8px">Produkt</th><th style="padding:6px 8px">Menge</th><th style="padding:6px 8px;text-align:right">Preis</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr style="border-top:2px solid #e2e8f0"><td colspan="2" style="padding:6px 8px"><strong>Gesamt</strong></td><td style="padding:6px 8px;text-align:right"><strong>€ ${p.total.toFixed(2)}</strong></td></tr></tfoot>
  </table>
  <p style="margin-top:20px;color:#64748b;font-size:13px">Bei Fragen wende dich bitte direkt an den Hof.</p>
</div>`
}

export function onsiteConfirmationEmailHtml(p: {
  customerName: string
  orderNumber: string
  farmName: string
  confirmationUrl: string
  pickupDate: string
  pickupTime: string
}): string {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="color:#15803d;margin-bottom:8px">Bestellung verbindlich bestätigen</h1>
  <p>Hallo <strong>${p.customerName}</strong>,</p>
  <p>du hast eine Bestellung (<strong>${p.orderNumber}</strong>) bei <strong>${p.farmName}</strong> aufgegeben.</p>
  <p>Abholung: <strong>${p.pickupDate}</strong> &nbsp;|&nbsp; <strong>${p.pickupTime} Uhr</strong></p>
  <p style="margin-top:16px">Bitte klicke auf den Button, um deine Bestellung verbindlich zu bestätigen:</p>
  <a href="${p.confirmationUrl}"
     style="display:inline-block;background:#15803d;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:8px 0">
    Bestellung bestätigen →
  </a>
  <p style="margin-top:20px;color:#94a3b8;font-size:12px">
    Wenn du diese Bestellung nicht aufgegeben hast, ignoriere diese E-Mail. Der Link läuft nach 48 Stunden ab.
  </p>
</div>`
}

export function farmerNotificationHtml(p: {
  farmerName: string
  customerName: string
  orderNumber: string
  pickupDate: string
  pickupTime: string
  items: Array<{ name: string; quantity: number }>
  total: number
  paymentLabel: string
}): string {
  const list = p.items.map((i) => `<li>${i.name} × ${i.quantity}</li>`).join('')
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="color:#15803d;margin-bottom:8px">🛒 Neue Bestellung eingegangen!</h1>
  <p>Hallo <strong>${p.farmerName}</strong>,</p>
  <p>du hast eine neue Bestellung von <strong>${p.customerName}</strong> erhalten.</p>
  <table style="width:100%;font-size:14px;border-collapse:collapse">
    <tr><td style="padding:4px 0;color:#64748b">Bestellnummer</td><td><strong>${p.orderNumber}</strong></td></tr>
    <tr><td style="padding:4px 0;color:#64748b">Abholung</td><td>${p.pickupDate} | ${p.pickupTime} Uhr</td></tr>
    <tr><td style="padding:4px 0;color:#64748b">Zahlung</td><td>${p.paymentLabel}</td></tr>
    <tr><td style="padding:4px 0;color:#64748b">Gesamt</td><td><strong>€ ${p.total.toFixed(2)}</strong></td></tr>
  </table>
  <h3 style="margin-top:16px;margin-bottom:4px">Bestellte Produkte:</h3>
  <ul style="margin:0;padding-left:20px">${list}</ul>
</div>`
}
