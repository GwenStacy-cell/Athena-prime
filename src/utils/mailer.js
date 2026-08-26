
import nodemailer from "nodemailer";

export async function send2FACode(toEmail, code, guildName) {
  if (!(process.env.GMAIL_USER || process.env.EMAIL_USER) || !(process.env.GMAIL_PASS || process.env.EMAIL_PASS)) {
    throw new Error("Email credentials are not configured in .env");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: (process.env.GMAIL_USER || process.env.EMAIL_USER),
      pass: (process.env.GMAIL_PASS || process.env.EMAIL_PASS)
    }
  });

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #333; border-radius: 10px; background-color: #1a1a1a; color: #fff;">
      <h2 style="color: #ff4747; text-align: center;">?? Athena Prime Security Alert ??</h2>
      <p style="font-size: 16px;">A critical security action was requested in <strong>${guildName}</strong>.</p>
      <p style="font-size: 16px;">To authorize this action, please enter the following 2FA code in Discord:</p>
      <div style="background-color: #2b2d31; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #5865F2;">${code}</span>
      </div>
      <p style="font-size: 14px; color: #999;">If you did not request this, your Discord account may be compromised. Ignore this email and the action will remain blocked.</p>
      <hr style="border-color: #333; margin-top: 30px;" />
      <p style="font-size: 12px; color: #666; text-align: center;">Athena Prime God-Tier Firewall &bull; Automated Security Dispatch</p>
    </div>
  `;

  console.log(`\n\n[SECURITY] 2FA CODE FOR ${guildName}: ${code}\n\n`);
  const mailOptions = {
    from: `"Athena Prime Security" <${(process.env.GMAIL_USER || process.env.EMAIL_USER)}>`,
    to: toEmail,
    subject: `[ACTION REQUIRED] 2FA Code for ${guildName}`,
    html: html
  };

  return await transporter.sendMail(mailOptions);
}

