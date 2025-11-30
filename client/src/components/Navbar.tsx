import { useState, useEffect } from 'react';
import { Search, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export const Navbar = () => {
    const [query, setQuery] = useState('');
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuthStore();

    // Sync query with URL search param if on search page
    useEffect(() => {
        if (location.pathname === '/search') {
            const params = new URLSearchParams(location.search);
            const q = params.get('q');
            if (q) setQuery(q);
        } else {
            setQuery('');
        }
    }, [location.pathname, location.search]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            navigate(`/search?q=${encodeURIComponent(query)}`);
        }
    };

    return (
        <div className="h-16 flex items-center justify-between px-6 bg-retro-bg sticky top-0 z-40 border-b border-white/5">
            {/* Left: Logo */}
            <div className="flex items-center space-x-3 md:hidden">
                <div className="w-8 h-8 bg-retro-primary rounded-full flex items-center justify-center font-bold text-black">SD</div>
                <span className="font-bold text-lg tracking-tight">Silent Disco</span>
            </div>

            {/* Center: Search Bar */}
            <div className="flex-1 max-w-2xl mx-auto px-4">
                <form onSubmit={handleSearch} className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400 group-focus-within:text-white transition-colors" />
                    </div>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search songs, albums, artists, podcasts"
                        className="block w-full pl-10 pr-3 py-2.5 border border-transparent rounded-lg leading-5 bg-white/10 text-gray-300 placeholder-gray-400 focus:outline-none focus:bg-white/20 focus:text-white sm:text-sm transition-all duration-200"
                    />
                </form>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center space-x-4 md:space-x-6">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-sm font-bold text-white cursor-pointer hover:scale-105 transition-transform">
                    {user?.username?.[0]?.toUpperCase() || <User size={16} />}
                </div>
            </div>
        </div>
    );
};
