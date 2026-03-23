const cron = require('node-cron');
const Household = require('../models/Household');
const User = require('../models/User');
const { sendReminderEmail } = require('./emailService');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function startScheduler() {
  // Run every day at 9 AM to check if any household needs a reminder
  cron.schedule('0 9 * * *', async () => {
    try {
      const today = new Date();
      const dayOfMonth = today.getDate();
      const monthName = MONTH_NAMES[today.getMonth()];

      console.log(`[Scheduler] Checking reminders for day ${dayOfMonth}...`);

      // Find households with reminders enabled and matching day
      const households = await Household.find({
        reminderEnabled: true,
        reminderDayOfMonth: dayOfMonth,
      }).populate('admin');

      for (const household of households) {
        const email = household.reminderEmail || household.admin?.email;
        if (!email) {
          console.log(`[Scheduler] No email for household ${household.name}, skipping`);
          continue;
        }

        try {
          await sendReminderEmail(email, household.name, monthName);
          console.log(`[Scheduler] Sent reminder to ${email} for ${household.name}`);
        } catch (err) {
          console.error(`[Scheduler] Failed to send to ${email}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Error:', err.message);
    }
  });

  console.log('[Scheduler] Monthly reminder scheduler started');
}

module.exports = { startScheduler };
