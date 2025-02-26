import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleAuthCallback } from '../../lib/auth';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const result = await handleAuthCallback();
        
        // Supabase handles token storage automatically
        // We just need to store any additional user info if needed
        localStorage.setItem('user_info', JSON.stringify(result.user));

        // Redirect to home page or dashboard
        navigate('/', { replace: true });
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/auth/error', { 
          replace: true,
          state: { error: error instanceof Error ? error.message : 'Authentication failed' }
        });
      }
    };

    handleAuth();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-4">Completing sign in...</h1>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    </div>
  );
} 