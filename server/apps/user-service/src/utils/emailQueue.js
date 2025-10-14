// user-service/src/utils/emailQueue.js

const rabbitmq = require('./rabbitmq');
const { buildEmailTemplate } = require('./otp');

async function sendOtpEmail(to, name, otp, purpose = 'VERIFY') {
  const { subject, html } = buildEmailTemplate(name, otp, purpose === 'LOGIN' ? 'LOGIN' : 'VERIFY');
  const message = {
    to,
    subject,
    html,
    text: `Mã OTP: ${otp}`,
    purpose
  };
  rabbitmq.publishToEmailQueue(message);
}

module.exports = { sendOtpEmail };
