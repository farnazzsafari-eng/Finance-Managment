const nodemailer = require('nodemailer');

let transporter;

async function getTransporter() {
  if (transporter) return transporter;

  // Use configured SMTP or fall back to Ethereal test account
  if (process.env.SMTP_HOST && process.env.SMTP_HOST !== 'smtp.ethereal.email') {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Create test account with Ethereal
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('Email: Using Ethereal test account:', testAccount.user);
    } catch (err) {
      console.warn('Email: Could not create test account:', err.message);
      return null;
    }
  }

  return transporter;
}

async function sendReminderEmail(toEmail, householdName, monthName) {
  const t = await getTransporter();
  if (!t) {
    console.warn('Email: No transporter available, skipping email to', toEmail);
    return null;
  }

  const info = await t.sendMail({
    from: `"Finance Manager" <${process.env.SMTP_USER || 'noreply@financeapp.local'}>`,
    to: toEmail,
    subject: `Time to update your finances for ${monthName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a2e;">Finance Manager Reminder</h2>
        <p>Hi there,</p>
        <p>It's time to update your financial records for <strong>${monthName}</strong>.</p>
        <p>Log in and import your latest bank statements to keep your records up to date.</p>
        <div style="margin: 24px 0;">
          <a href="http://localhost:5173/import"
             style="background: #1a1a2e; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
            Import Statements
          </a>
        </div>
        <p style="color: #888; font-size: 0.85rem;">
          This reminder was sent for the ${householdName} household.
          You can disable reminders in Settings.
        </p>
      </div>
    `,
  });

  // Log Ethereal URL for testing
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log('Email preview:', previewUrl);
  }

  return info;
}

module.exports = { sendReminderEmail, getTransporter };
