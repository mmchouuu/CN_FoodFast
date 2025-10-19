// user-service/src/utils/otp.js

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildEmailTemplate(name, otp, purpose = 'VERIFY') {
  const subject =
    purpose === 'LOGIN'
      ? 'Your FoodFast login OTP'
      : 'FoodFast verification code';
  const recipient = name || 'there';
  const actionLine =
    purpose === 'LOGIN'
      ? 'Use this one-time code to complete your login.'
      : 'Use this one-time code to verify your account.';

  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #fff7ed; border: 1px solid #fb923c; border-radius: 16px; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #ea580c; text-align: center; margin-bottom: 16px;">FoodFast security code</h2>
      <p style="font-size: 14px; color: #1f2937;">Hello <strong>${recipient}</strong>,</p>
      <p style="font-size: 14px; color: #374151; margin: 16px 0;">${actionLine}</p>
      <div style="margin: 20px 0; padding: 18px; background-color: #fef3c7; border: 1px dashed #fbbf24; border-radius: 12px; text-align: center;">
        <p style="margin: 0; font-size: 12px; letter-spacing: 4px; color: #92400e;">OTP (valid for 5 minutes)</p>
        <p style="margin: 12px 0 0; font-size: 32px; letter-spacing: 12px; font-weight: 700; color: #b45309;">${otp}</p>
      </div>
      <p style="font-size: 12px; color: #6b7280;">If you did not request this code, please ignore this email or contact FoodFast support.</p>
      <hr style="border: none; border-top: 1px dashed #fb923c; margin: 24px 0;">
      <p style="font-size: 12px; color: #9ca3af; text-align: center;">FoodFast · Delicious moments delivered.</p>
    </div>`;

  const text = [
    `Hello ${recipient},`,
    actionLine,
    `OTP (valid for 5 minutes): ${otp}`,
    'If you did not request this code, please ignore this email.',
  ].join('\n');

  return { subject, html, text };
}

module.exports = { generateOTP, buildEmailTemplate };
