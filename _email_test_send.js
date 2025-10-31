const nodemailer = require("nodemailer");

(async () => {
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

    const mailOptions = {
      from: "info@bzcart.store",
      to: "recipient@example.com",
      subject: "Test: hosted-favicon (no attachment)",
      html: `<!doctype html><html><body>
        <div style="background:#fff;padding:20px;font-family:Arial,sans-serif;max-width:600px;margin:20px auto;border-radius:8px;">
          <div style="text-align:center;background:linear-gradient(135deg,#ffa500,#ff8c00);padding:24px;border-radius:8px;color:#fff;">
            <img src="https://bzcart.store/images/IMG_3765.PNG" alt="BZ Cart" width="140" height="140" style="vertical-align:middle;border-radius:12px;margin-right:12px;display:inline-block;" />
            <div style="display:inline-block;vertical-align:middle;font-size:28px;font-weight:bold;">bzcart.store</div>
          </div>
          <div style="padding:20px;text-align:center;">This is a test message referencing the hosted favicon (should not be an attachment).</div>
        </div>
      </body></html>`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Sent. Preview URL:", nodemailer.getTestMessageUrl(info));
    console.log("Message ID:", info.messageId);
    console.log("Raw send info keys:", Object.keys(info));
  } catch (err) {
    console.error("Test send error:", err);
  }
})();
