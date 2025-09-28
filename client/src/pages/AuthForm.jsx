// src/components/AuthForm.js
import React, { useState } from 'react';

const AuthForm = ({ onClose, onSignup, onForgot, onLogin }) => {
  const [mode, setMode] = useState('login'); // login, signup, forgot
  const [step, setStep] = useState(1); // forgot password step
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [otp, setOtp] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();

    if (mode === 'login') {
      console.log('Login', { email, password });
      if (onLogin) onLogin({ email, password });
    } else if (mode === 'signup') {
      console.log('Sign Up', { firstName, lastName, email, password, phone });
      if (onSignup) onSignup({ firstName, lastName, email, password, phone });
    } else if (mode === 'forgot') {
      if (step === 1) {
        console.log('Send OTP to email', email);
        setStep(2);
      } else if (step === 2) {
        console.log('Reset password with OTP', { email, otp, password });
        if (onForgot) onForgot({ email, otp, password });
      }
    }
  };

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black/50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg w-80 relative">
        <h2 className="text-xl font-bold mb-4 text-center">
          {mode === 'login' && 'Login'}
          {mode === 'signup' && 'Sign Up'}
          {mode === 'forgot' && 'Reset Password'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Login & Sign Up */}
          {(mode === 'login' || mode === 'signup') && (
            <>
              {mode === 'signup' && (
                <>
                  <input
                    type="text"
                    placeholder="First Name"
                    className="border p-2 rounded"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    className="border p-2 rounded"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </>
              )}
              <input
                type="email"
                placeholder="Email"
                className="border p-2 rounded"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                className="border p-2 rounded"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {mode === 'signup' && (
                <input
                  type="tel"
                  placeholder="Phone"
                  className="border p-2 rounded"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              )}
            </>
          )}

          {/* Forgot Password */}
          {mode === 'forgot' && step === 1 && (
            <input
              type="email"
              placeholder="Email"
              className="border p-2 rounded"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}

          {mode === 'forgot' && step === 2 && (
            <>
              <input
                type="text"
                placeholder="Enter OTP"
                className="border p-2 rounded"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="New Password"
                className="border p-2 rounded"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </>
          )}

          <button
            type="submit"
            className="btn-solid w-full py-2 text-white bg-orange-500 rounded hover:bg-orange-600"
          >
            {mode === 'login' && 'Login'}
            {mode === 'signup' && 'Sign Up'}
            {mode === 'forgot' && (step === 1 ? 'Send OTP' : 'Reset Password')}
          </button>
        </form>

        {/* Switch modes */}
        <div className="mt-4 flex justify-between text-sm text-textColor flex-wrap gap-2">
          {mode !== 'login' && (
            <button onClick={() => { setMode('login'); setStep(1); }}>Back to Login</button>
          )}
          {mode === 'login' && (
            <>
              <button onClick={() => { setMode('signup'); setStep(1); }}>Sign Up</button>
              <button onClick={() => { setMode('forgot'); setStep(1); }}>Forgot Password?</button>
            </>
          )}
        </div>

        {/* Close button */}
        <button
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 font-bold text-lg"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default AuthForm;
