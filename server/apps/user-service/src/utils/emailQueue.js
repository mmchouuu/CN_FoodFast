// user-service/src/utils/emailQueue.js

const rabbitmq = require('./rabbitmq');
const { buildEmailTemplate } = require('./otp');

function resolveVerifyLink({ verifyLink, email, otp }) {
  if (verifyLink) return verifyLink;

  const frontendBase =
    process.env.FRONTEND_BASE_URL && process.env.FRONTEND_BASE_URL.trim().length
      ? `${process.env.FRONTEND_BASE_URL.replace(/\/$/, '')}/restaurant/auth/verify`
      : null;

  const fallback = frontendBase || 'http://localhost:5173/restaurant/auth/verify';

  try {
    const url = new URL(fallback);
    if (email) url.searchParams.set('email', email);
    if (otp) url.searchParams.set('otp', otp);
    return url.toString();
  } catch (error) {
    const separator = fallback.includes('?') ? '&' : '?';
    const params = [];
    if (email) params.push(`email=${encodeURIComponent(email)}`);
    if (otp) params.push(`otp=${encodeURIComponent(otp)}`);
    return `${fallback}${separator}${params.join('&')}`;
  }
}

function buildOwnerVerificationEmail({ name, otp, password, verifyLink, email }) {
  const recipient = name || 'Restaurant partner';
  const subject = 'Verify your FoodFast owner account';
  const safeLink = resolveVerifyLink({ verifyLink, email, otp });
  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #fff7ed; border: 1px solid #fb923c; border-radius: 16px; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #f97316; text-align: center; margin-bottom: 16px;">Almost there!</h2>
      <p style="font-size: 14px; color: #1f2937;">Hello <strong>${recipient}</strong>,</p>
      <p style="font-size: 14px; color: #374151; margin: 12px 0;">Use the one-time details below to verify your FoodFast owner account within 5 minutes.</p>
      <div style="margin: 18px 0; padding: 18px; background-color: #fef3c7; border: 1px dashed #fbbf24; border-radius: 12px;">
        <p style="margin: 0; font-size: 12px; letter-spacing: 4px; color: #92400e;">OTP CODE</p>
        <p style="margin: 12px 0 0; font-size: 32px; letter-spacing: 12px; font-weight: 700; color: #b45309;">${otp}</p>
        <p style="margin: 20px 0 0; font-size: 12px; letter-spacing: 2px; color: #92400e;">TEMPORARY PASSWORD</p>
        <p style="margin: 8px 0 0; font-size: 22px; font-weight: 600; color: #b45309;">${password}</p>
      </div>
      <p style="font-size: 13px; color: #374151;">Click the button below if you need to return to the verification page later:</p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${safeLink}" style="background-color: #f97316; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 9999px; font-weight: 600; display: inline-block;">Verify my account</a>
      </div>
      <p style="font-size: 12px; color: #6b7280;">After you verify successfully, you'll be asked to create a permanent password before signing in.</p>
      <hr style="border: none; border-top: 1px dashed #fb923c; margin: 24px 0;">
      <p style="font-size: 12px; color: #9ca3af; text-align: center;">FoodFast team - Delivering delicious moments.</p>
    </div>`;

  const textParts = [
    `Hello ${recipient},`,
    'Use the following details to verify your FoodFast owner account (valid for 5 minutes):',
    `OTP: ${otp}`,
    `Temporary password: ${password}`,
    `Verification link: ${safeLink}`,
    'After verification you will be prompted to set a permanent password.',
  ];

  return {
    subject,
    html,
    text: textParts.join('\n'),
  };
}

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
      <p style="font-size: 12px; color: #9ca3af; text-align: center;">FoodFast team – Delivering delicious moments.</p>
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

function buildOwnerRejectionEmail({ name, reason }) {
  const subject = 'FoodFast restaurant application update';
  const recipient = name || 'Restaurant partner';
  const safeReason = reason || 'No specific reason provided';
  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #fef2f2; border: 1px solid #f87171; border-radius: 16px; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #b91c1c; text-align: center; margin-bottom: 16px;">Application review update</h2>
      <p style="font-size: 14px; color: #1f2937;">Hello <strong>${recipient}</strong>,</p>
      <p style="font-size: 14px; color: #374151;">We appreciate your interest in partnering with FoodFast. After reviewing your submission, we’re unable to approve it at this time.</p>
      <div style="margin: 20px 0; padding: 16px; background-color: #fee2e2; border: 1px dashed #f87171; border-radius: 12px;">
        <p style="margin: 0; font-size: 13px; color: #991b1b;">Reason from the review team</p>
        <p style="margin: 8px 0 0; font-size: 15px; color: #7f1d1d;">${safeReason}</p>
      </div>
      <p style="font-size: 13px; color: #374151;">You can revise your information and re-submit at any time. If you have questions, reply to this email and our support staff will assist you.</p>
      <hr style="border: none; border-top: 1px dashed #f87171; margin: 24px 0;">
      <p style="font-size: 12px; color: #9ca3af; text-align: center;">FoodFast team – Delivering delicious moments.</p>
    </div>`;

  const text = [
    `Hello ${recipient},`,
    'We are unable to approve your application at this time.',
    `Reason: ${safeReason}`,
    'You may resubmit updated information or contact support for more details.',
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
    verifyLink,
    reason,
  } = payload;

  if (!to) {
    throw new Error('Email payload missing recipient');
  }

  let emailContent;

  if (purpose === 'OWNER_VERIFY') {
    if (!otp || !password) {
      throw new Error('OTP and temporary password are required for owner verification email');
    }
    emailContent = buildOwnerVerificationEmail({ name, otp, password, verifyLink });
  } else if (purpose === 'RESTAURANT_APPROVAL') {
    if (!otp) {
      throw new Error('OTP is required for approval email');
    }
    emailContent = buildRestaurantApprovalEmail({ name, otp, password });
  } else if (purpose === 'OWNER_REJECTED') {
    emailContent = buildOwnerRejectionEmail({ name, reason });
  } else {
    if (!otp) {
      throw new Error('OTP code is required');
    }
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
