const userModel = require('../models/user.model');
const bcrypt = require('../utils/bcrypt');
const jwt = require('../utils/jwt');
const amqp = require('amqplib');

// ===============================
// 🔹 HÀM SINH MÃ OTP
// ===============================
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 chữ số
}

// ===============================
// 🔹 TẠO TEMPLATE EMAIL OTP (HTML)
// ===============================
function buildEmailTemplate(name, otp) {
  return `
  <div style="font-family: Arial, sans-serif; background-color: #fff3e0; border: 2px solid #ff9800; border-radius: 10px; max-width: 600px; margin: auto; padding: 20px;">
    <h2 style="text-align: center; color: #e65100;">🍔 TastyQueen</h2>
    <hr style="border: 1px solid #ff9800;">
    <p>Xin chào <strong>${name}</strong>,</p>
    <p>Cảm ơn bạn đã đăng ký tài khoản tại <b>TastyQueen</b> 🍔.</p>
    <p>Để hoàn tất quá trình đăng ký, vui lòng nhập mã OTP sau:</p>
    <h1 style="text-align: center; color: #d32f2f; letter-spacing: 4px;">${otp}</h1>
    <p style="text-align: center; color: #555;">⚠️ Mã OTP này có hiệu lực trong 5 phút.<br>Vui lòng không chia sẻ mã này với ai.</p>
    <hr style="border: 1px solid #ff9800;">
    <p style="text-align: center; color: #777; font-size: 12px;">
      Email này được gửi tự động bởi hệ thống <b>FoodFast</b>.<br>
      Vui lòng không trả lời email này.
    </p>
  </div>
  `;
}

// ===============================
// 🔹 GỬI EMAIL QUA RABBITMQ
// ===============================
async function sendEmailToQueue(payload) {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(process.env.RABBITMQ_QUEUE, { durable: true });

    channel.sendToQueue(
      process.env.RABBITMQ_QUEUE,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true }
    );

    console.log('📤 [user-service] Sent email job to queue:', payload.to);
    await channel.close();
    await connection.close();
  } catch (err) {
    console.error('❌ Error sending email to queue:', err.message);
  }
}

// ===============================
// 🔹 ĐĂNG KÝ NGƯỜI DÙNG (REGISTER)
// ===============================
async function register(payload) {
  const existing = await userModel.findByEmail(payload.email);
  if (existing) throw new Error('Email already used');

  const password_hash = await bcrypt.hash(payload.password);
  const otp = generateOTP();

  const user = await userModel.createUser({
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: payload.email,
    password_hash,
    phone: payload.phone,
    role: payload.role || 'customer',
    otp_code: otp,
    is_verified: false,
    is_approved: payload.role === 'restaurant' ? false : true // nhà hàng cần admin duyệt
  });

  // 🧠 Gửi email nếu là KHÁCH HÀNG
  if (user.role === 'customer') {
    const htmlTemplate = buildEmailTemplate(user.first_name || 'bạn', otp);

    await sendEmailToQueue({
      to: user.email,
      subject: '🍔 Xác thực tài khoản TastyQueen',
      text: `Mã OTP của bạn là ${otp}`,
      html: htmlTemplate
    });

    return { message: 'Customer created, please verify OTP sent to email.' };
  } else if (user.role === 'restaurant') {
    return {
      message: 'Restaurant registered successfully. Waiting for admin approval before sending verification email.'
    };
  } else {
    return { message: 'User created successfully.' };
  }
}

// ===============================
// 🔹 XÁC THỰC OTP
// ===============================
async function verifyOTP(email, otp) {
  const user = await userModel.findByEmail(email);
  if (!user) throw new Error('User not found');
  if (user.otp_code !== otp) throw new Error('Invalid OTP');

  await userModel.verifyUser(email);
  return { message: 'Email verified successfully, you can now login.' };
}

// ===============================
// 🔹 ĐĂNG NHẬP
// ===============================
async function login({ email, password }) {
  const user = await userModel.findByEmail(email);
  if (!user) throw new Error('Invalid credentials');
  if (!user.is_verified) throw new Error('Account not verified. Please check your email.');
  if (user.role === 'restaurant' && !user.is_approved)
    throw new Error('Restaurant account is pending admin approval.');

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new Error('Invalid credentials');

  const token = jwt.sign({ userId: user.id }, { expiresIn: '15m' });

  return {
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role
    },
    token,
  };
}

// ===============================
// 🔹 LẤY TẤT CẢ NGƯỜI DÙNG
// ===============================
async function getAllUsers() {
  return await userModel.getAll();
}

module.exports = {
  register,
  verifyOTP,
  login,
  getAllUsers,
  sendEmailToQueue
};
