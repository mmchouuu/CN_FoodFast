import React, { useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';

const EnableOwner = () => {
  const { setIsOwner, navigate } = useAppContext();

  useEffect(() => {
    setIsOwner(true);
    navigate('/owner');
  }, [setIsOwner, navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center text-center p-6">
      <div className="max-w-md">
        <h1 className="text-2xl font-bold mb-2">Enabling Owner Mode…</h1>
        <p className="text-sm text-gray-600">You will be redirected to the Restaurant Dashboard.</p>
      </div>
    </div>
  );
};

export default EnableOwner;







