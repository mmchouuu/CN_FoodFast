import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';

const ForgotPassword = () => {
  const { requestPasswordReset } = useAppContext();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setInfo('');
    try {
      await requestPasswordReset(email.trim());
      setInfo('If this email exists, a reset link will be sent.');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-padd-container py-20">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Forgot password</h1>
        <p className="mb-6 text-sm text-gray-600">Enter your email to receive password reset instructions.</p>
        {info ? <p className="mb-4 text-sm text-orange-600">{info}</p> : null}
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm text-gray-600">
            Email
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
          </label>
          <button type="submit" disabled={loading} className="w-full rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">{loading ? 'Sending…' : 'Send reset link'}</button>
        </form>
        <div className="mt-4 text-right text-sm">
          <Link to="/auth/login" className="text-gray-600 hover:underline">Back to login</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
