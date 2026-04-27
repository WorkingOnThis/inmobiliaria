import nodemailer from "nodemailer";

export interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (_transporter) return _transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  _transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  return _transporter;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const transporter = getTransporter();
  const from = process.env.GMAIL_USER;

  if (!transporter || !from) {
    console.warn("⚠️ GMAIL_USER o GMAIL_APP_PASSWORD no configurados. Email no enviado.");
    console.log("📧 Email would be sent:", { to: options.to, subject: options.subject });
    return;
  }

  await transporter.sendMail({
    from: `Arce Administración <${from}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });

  console.log("✅ Email enviado a:", options.to);
}
