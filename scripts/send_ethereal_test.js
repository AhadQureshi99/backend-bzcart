const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

const recipient = process.argv[2] || "test@example.com";

async function main() {
  try {
    const testAccount = await nodemailer.createTestAccount();

    const transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const logoPath = path.resolve(__dirname, "..", "images", "IMG_3765.PNG");
    const attachments = [];
    if (fs.existsSync(logoPath)) {
      attachments.push({
        filename: path.basename(logoPath),
        path: logoPath,
        cid: "bzcartlogo",
      });
    } else {
      console.warn("Warning: logo file not found at", logoPath);
    }

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Test OTP (Ethereal)</title>
  </head>
  <body>
    <div style="max-width:600px;margin:20px auto;font-family:Arial,Helvetica,sans-serif;">
      <div style="text-align:center;padding:16px 0;">
        <img src="cid:bzcartlogo" alt="BZ Cart" width="64" height="64" style="display:block;margin:0 auto 8px;" />
        <h2 style="margin:0;">BZ Cart - Test OTP (Ethereal)</h2>
      </div>
      <div style="padding:20px;background:#fff;border-radius:8px;">
        <p>Hello — this is a test OTP email sent via Ethereal to verify CID embedding.</p>
        <div style="font-size:32px;font-weight:bold;color:#ff8c00;text-align:center;padding:12px;border:2px solid #ff8c00;border-radius:8px;">123456</div>
        <p style="color:#777;font-size:14px">If you see the logo above, embedding worked.</p>
      </div>
    </div>
  </body>
</html>`;

    const info = await transporter.sendMail({
      from: "BZ Cart <no-reply@bzcart.local>",
      to: recipient,
      subject: "BZ Cart — Test OTP (Ethereal)",
      html,
      attachments,
    });

    console.log("Message sent. MessageId:", info.messageId);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log("Preview URL:", previewUrl);
    console.log("Ethereal account user:", testAccount.user);
    console.log("Ethereal account pass:", testAccount.pass);
  } catch (err) {
    console.error("Failed to send via Ethereal:", err);
    process.exit(1);
  }
}

main();
