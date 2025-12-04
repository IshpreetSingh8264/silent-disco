import { useState, useEffect, useRef } from 'react';
import { Search, User, X, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { SearchOverlay } from './SearchOverlay';


export const Navbar = () => {
    const [query, setQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuthStore();
    const searchRef = useRef<HTMLDivElement>(null);

    // Sync query with URL search param if on search page
    useEffect(() => {
        if (location.pathname === '/search') {
            const params = new URLSearchParams(location.search);
            const q = params.get('q');
            if (q && q !== query) {
                setQuery(q);
            }
        } else {
            setQuery('');
        }
    }, [location.pathname, location.search]);

    // Close suggestions on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            setShowSuggestions(false);
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
            <div className="flex-1 max-w-2xl mx-auto px-4" ref={searchRef}>
                <form onSubmit={handleSearch} className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400 group-focus-within:text-white transition-colors" />
                    </div>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            if (e.target.value.length >= 1) setShowSuggestions(true);
                        }}
                        onFocus={() => query.length >= 1 && setShowSuggestions(true)}
                        placeholder="Search songs, albums, artists..."
                        className="block w-full pl-10 pr-3 py-2.5 border border-transparent rounded-lg leading-5 bg-white/10 text-gray-300 placeholder-gray-400 focus:outline-none focus:bg-white/20 focus:text-white sm:text-sm transition-all duration-200"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => { setQuery(''); setShowSuggestions(false); }}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                        >
                            <X size={16} />
                        </button>
                    )}

                    {/* New Typeahead Overlay */}
                    {showSuggestions && (
                        <SearchOverlay
                            query={query}
                            onClose={() => setShowSuggestions(false)}
                            onClear={() => setQuery('')}
                        />
                    )}
                </form>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center space-x-4 md:space-x-6">
                <div className="relative">
                    <div
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-sm font-bold text-white cursor-pointer hover:scale-105 transition-transform"
                    >
                        {user?.username?.[0]?.toUpperCase() || <User size={16} />}
                    </div>

                    {showUserMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-retro-surface border border-white/10 rounded-lg shadow-xl py-1 z-50">
                            <div className="px-4 py-2 border-b border-white/5">
                                <p className="text-sm font-medium text-white">{user?.username || 'User'}</p>
                            </div>
                            <button
                                onClick={() => { logout(); setShowUserMenu(false); }}
                                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 flex items-center space-x-2"
                            >
                                <LogOut size={14} />
                                <span>Log Out</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

