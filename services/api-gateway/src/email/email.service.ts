import * as nodemailer from 'nodemailer';

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  const from = `"Ceylonify" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`;

  await createTransport().sendMail({
    from,
    to,
    subject: 'Reset your Ceylonify password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;">
        <h2 style="color:#0ea5e9;margin:0 0 4px;">Ceylonify</h2>
        <p style="color:#94a3b8;font-size:12px;margin:0 0 24px;">Sri Lanka Travel Platform</p>
        <h3 style="color:#1e293b;margin:0 0 12px;">Reset your password</h3>
        <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 24px;">
          We received a request to reset the password for your Ceylonify account.
          Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
        </p>
        <a href="${resetLink}"
           style="display:inline-block;padding:13px 32px;background:#0ea5e9;color:#fff;font-weight:700;border-radius:8px;text-decoration:none;font-size:15px;">
          Reset Password
        </a>
        <p style="color:#94a3b8;font-size:13px;margin:24px 0 0;">
          If you didn't request this, you can safely ignore this email — your password won't change.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="color:#cbd5e1;font-size:12px;margin:0;">© ${new Date().getFullYear()} Ceylonify</p>
      </div>
    `,
  });
}
