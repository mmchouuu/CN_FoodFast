// user-service/src/services/user.service.js
const userModel = require('../models/user.model');
const bcrypt = require('../utils/bcrypt');
const jwt = require('../utils/jwt');

async function register(payload){
  const existing = await userModel.findByEmail(payload.email);
  if(existing) throw new Error('Email already used');
  const password_hash = await bcrypt.hash(payload.password);
  const user = await userModel.createUser({
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: payload.email,
    password_hash,
    phone: payload.phone
  });
  const token = jwt.sign({ userId: user.id }, { expiresIn: '15m' });
  return { user, token };
}

async function login({email, password}){
  const user = await userModel.findByEmail(email);
  if(!user) throw new Error('Invalid credentials');
  const ok = await bcrypt.compare(password, user.password_hash);
  if(!ok) throw new Error('Invalid credentials');
  const token = jwt.sign({ userId: user.id }, { expiresIn: '15m' });
  return { user, token };
}

async function getAllUsers() {
  const users = await userModel.findAll();
  return users;
}

module.exports = { register, login, getAllUsers };
