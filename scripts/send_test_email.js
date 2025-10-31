const nodemailer = require("nodemailer");
const path = require("path");

// Usage: node ./scripts/send_test_email.js recipient@example.com
const recipient = process.argv[2] || process.env.TEST_EMAIL;
if (!recipient) {
  console.error(
    "Please provide a recipient email as the first argument or set TEST_EMAIL env var."
  );
  process.exit(2);
}

async function main() {
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT || "465"),
    secure: true,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: { rejectUnauthorized: false },
  });

  const logoPath = path.resolve(__dirname, "..", "images", "IMG_3765.PNG");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Test OTP</title>
  </head>
  <body>
    <div style="max-width:600px;margin:20px auto;font-family:Arial,Helvetica,sans-serif;">
      <div style="text-align:center;padding:16px 0;">
        <img src="cid:bzcartlogo" alt="BZ Cart" width="64" height="64" style="display:block;margin:0 auto 8px;" />
        <h2 style="margin:0;">BZ Cart - Test OTP</h2>
      </div>
      <div style="padding:20px;background:#fff;border-radius:8px;">
        <p>Hello — this is a test OTP email from your application.</p>
        <div style="font-size:32px;font-weight:bold;color:#ff8c00;text-align:center;padding:12px;border:2px solid #ff8c00;border-radius:8px;">123456</div>
        <p style="color:#777;font-size:14px">This image is embedded via CID. If you see the logo above, embedding worked.</p>
      </div>
    </div>
  </body>
</html>`;

  const mailOptions = {
    from: process.env.MAIL_FROM,
    to: recipient,
    subject: "BZ Cart — Test OTP (CID image)",
    html,
    attachments: [
      {
        filename: path.basename(logoPath),
        path: logoPath,
        cid: "bzcartlogo",
      },
    ],
  };

  try {
    console.log("Sending test email to", recipient);
    const info = await transporter.sendMail(mailOptions);
    console.log("Test email sent, messageId:", info.messageId || info.response);
    process.exit(0);
  } catch (err) {
    console.error("Failed to send test email:", err);
    process.exit(1);
  }
}

main();
