import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const { user, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login Error: " + error.message);
    }
  };

  if (user === undefined) return null;

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-100 text-center"
      >
        <div className="mb-8">
          <h1 className="text-5xl font-bebas text-accent tracking-wider">PEERBRIDGE</h1>
          <p className="text-gray-500 font-mono text-sm mt-2">DIRECT P2P FILE SHARING</p>
        </div>

        <div className="space-y-6">
          <p className="text-gray-600 leading-relaxed">
            Secure, browser-to-browser transfers. No cloud, no storage, pure privacy.
          </p>
          
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center space-x-3 bg-white border border-gray-200 py-4 px-6 rounded-2xl hover:bg-gray-50 transition-all group shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span className="font-medium text-gray-700">Continue with Google</span>
          </button>

          <div className="pt-6 border-t border-gray-100 flex justify-center space-x-4 grayscale opacity-50">
            <span className="text-[10px] font-mono tracking-tighter">WebRTC</span>
            <span className="text-[10px] font-mono tracking-tighter">P2P</span>
            <span className="text-[10px] font-mono tracking-tighter">AES-256</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
