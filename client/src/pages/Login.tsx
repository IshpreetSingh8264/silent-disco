import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

export const Login = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const login = useAuthStore((state) => state.login);
    const navigate = useNavigate();

    const validateForm = () => {
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            setError('Please enter a valid email address');
            return false;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters long');
            return false;
        }
        if (!isLogin) {
            if (!username.trim()) {
                setError('Username is required');
                return false;
            }
            if (!password.match(/[A-Z]/)) {
                setError('Password must contain at least one uppercase letter');
                return false;
            }
            if (!password.match(/[0-9]/)) {
                setError('Password must contain at least one number');
                return false;
            }
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!validateForm()) return;

        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';

        try {
            const body = isLogin
                ? { email, password }
                : { email, username, password };

            const res = await fetch(`http://localhost:3000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Something went wrong');

            login(data.user, data.token);
            navigate('/');
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-retro-bg relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-retro-primary/20 via-retro-bg to-retro-bg pointer-events-none" />

            <div className="w-full max-w-md p-8 bg-retro-surface/50 backdrop-blur-lg rounded-2xl border border-white/10 shadow-2xl z-10">
                <h2 className="text-3xl font-bold text-center mb-8 text-white tracking-tight">
                    {isLogin ? 'Welcome Back' : 'Join the Party'}
                </h2>

                {error && (
                    <div className="mb-4 p-3 bg-retro-error/20 border border-retro-error/50 text-retro-error rounded-lg text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-retro-primary focus:ring-1 focus:ring-retro-primary transition-all"
                            placeholder="name@example.com"
                            required
                        />
                    </div>

                    {!isLogin && (
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-retro-primary focus:ring-1 focus:ring-retro-primary transition-all"
                                placeholder="Choose a display name"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-retro-primary focus:ring-1 focus:ring-retro-primary transition-all"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-retro-primary hover:bg-retro-primary/90 text-black font-bold py-3 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {isLogin ? 'Sign In' : 'Create Account'}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                    </button>
                </div>
            </div>
        </div>
    );
};
