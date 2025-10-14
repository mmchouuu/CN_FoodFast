// user-service/src/utils/otp.js

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildEmailTemplate(name, otp, purpose = 'Xác thực') {
  const subjectLine = (purpose === 'LOGIN') ? 'Mã OTP đăng nhập' : 'Mã OTP xác thực tài khoản';
  return {
    subject: subjectLine,
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #fff3e0; border: 2px solid #ff9800; border-radius: 10px; max-width: 600px; margin: auto; padding: 20px;">
        <h2 style="text-align: center; color: #e65100;">🍔 TastyQueen</h2>
        <hr style="border: 1px solid #ff9800;">
        <p>Xin chào <strong>${name || ''}</strong>,</p>
        <p>${purpose === 'LOGIN' ? 'Bạn yêu cầu mã OTP để đăng nhập.' : 'Để hoàn tất quá trình xác thực, vui lòng nhập mã OTP sau:'}</p>
        <h1 style="text-align: center; color: #d32f2f; letter-spacing: 4px;">${otp}</h1>
        <p style="text-align: center; color: #555;">⚠️ Mã OTP này có hiệu lực trong 5 phút.<br>Vui lòng không chia sẻ mã này với ai.</p>
        <hr style="border: 1px solid #ff9800;">
        <p style="text-align: center; color: #777; font-size: 12px;">Email này được gửi tự động bởi hệ thống <b>FoodFast</b>.</p>
      </div>`
  };
}

module.exports = { generateOTP, buildEmailTemplate };
