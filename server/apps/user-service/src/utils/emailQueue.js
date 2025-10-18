// user-service/src/utils/emailQueue.js

const rabbitmq = require('./rabbitmq');
const { buildEmailTemplate } = require('./otp');

function buildRestaurantApprovalEmail({ name, otp, password }) {
  const recipient = name || 'Restaurant partner';
  const subject = 'FoodFast restaurant activation details';
  const safePassword = password || 'will be provided separately';
  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #fff7ed; border: 1px solid #f97316; border-radius: 16px; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #ea580c; text-align: center; margin-bottom: 16px;">Your restaurant is approved!</h2>
      <p style="font-size: 14px; color: #1f2937;">Hello <strong>${recipient}</strong>,</p>
      <p style="font-size: 14px; color: #374151;">We have approved your restaurant profile. Use the one-time credentials below within 5 minutes to activate the account:</p>
      <div style="margin: 20px 0; padding: 16px; background-color: #fef3c7; border: 1px dashed #f59e0b; border-radius: 12px;">
        <p style="margin: 0; font-size: 13px; color: #92400e;">Activation OTP (6 digits)</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 8px; color: #b45309; margin: 8px 0 16px;">${otp}</p>
        <p style="margin: 0; font-size: 13px; color: #92400e;">Activation password</p>
        <p style="font-size: 18px; font-weight: 600; color: #b45309; margin: 8px 0 0;">${safePassword}</p>
      </div>
      <p style="font-size: 13px; color: #374151;">After submitting the OTP and activation password, you will be asked to create a new password for future sign in.</p>
      <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">If you did not request this, please reach out to the FoodFast support team immediately.</p>
      <hr style="border: none; border-top: 1px dashed #f97316; margin: 24px 0;">
      <p style="font-size: 12px; color: #9ca3af; text-align: center;">FoodFast team — Delivering delicious moments.</p>
    </div>`;

  const text = [
    `Hello ${recipient},`,
    'Your restaurant profile has been approved.',
    `OTP (valid for 5 minutes): ${otp}`,
    `Activation password: ${safePassword}`,
    'Submit the OTP and activation password to continue, then choose your permanent password.',
    'If you did not request this email, contact FoodFast support immediately.',
  ].join('\n');

  return { subject, html, text };
}

async function sendOtpEmail(arg0, nameArg, otpArg, purposeArg = 'VERIFY') {
  const payload =
    typeof arg0 === 'object' && arg0 !== null && !Array.isArray(arg0)
      ? arg0
      : { to: arg0, name: nameArg, otp: otpArg, purpose: purposeArg };

  const {
    to,
    name,
    otp,
    purpose = 'VERIFY',
    password,
  } = payload;

  if (!to || !otp) {
    throw new Error('Email payload missing recipient or OTP code');
  }

  let emailContent;

  if (purpose === 'RESTAURANT_APPROVAL') {
    emailContent = buildRestaurantApprovalEmail({ name, otp, password });
  } else {
    const template = buildEmailTemplate(name, otp, purpose);
    emailContent = {
      subject: template.subject,
      html: template.html,
      text: template.text || `OTP code: ${otp}`,
    };
  }

  const message = {
    to,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    purpose,
  };

  rabbitmq.publishToEmailQueue(message);
}

module.exports = { sendOtpEmail };
