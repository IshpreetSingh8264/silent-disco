import { useState, useEffect, useRef } from 'react';
import { Search, User, Play, X, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { usePlayerStore } from '../store/usePlayerStore';

export const Navbar = () => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuthStore();
    const { playTrack } = usePlayerStore();
    const searchRef = useRef<HTMLDivElement>(null);

    // Sync query with URL search param if on search page
    // Debounced Typeahead & Instant Search
    useEffect(() => {
        const timer = setTimeout(async () => {
            const trimmedQuery = query.trim();

            // If on search page, update URL (Instant Search)
            if (location.pathname === '/search') {
                const currentQ = new URLSearchParams(location.search).get('q');
                if (trimmedQuery !== currentQ) {
                    if (trimmedQuery) {
                        navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`, { replace: true });
                    } else {
                        navigate(`/search`, { replace: true });
                    }
                }
                setShowSuggestions(false); // Hide dropdown on search page
                return;
            }

            // Otherwise, fetch suggestions
            if (trimmedQuery.length >= 2) {
                try {
                    const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(trimmedQuery)}`);
                    const data = await res.json();
                    setSuggestions(data);
                    setShowSuggestions(true);
                    setSelectedIndex(-1); // Reset selection on new results
                } catch (e) {
                    console.error(e);
                }
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 120); // Reduced debounce to 120ms for snappier feel
        return () => clearTimeout(timer);
    }, [query, location.pathname, navigate, location.search]);

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

    const handleSuggestionClick = (track: any) => {
        playTrack(track);
        setShowSuggestions(false);
        // setQuery(''); // Keep query for context
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, -1));
        } else if (e.key === 'Enter') {
            if (selectedIndex >= 0) {
                e.preventDefault();
                handleSuggestionClick(suggestions[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    // Prevent loop: Only sync from URL if query is empty or we just navigated (simple check)
    // Actually, we need to sync if the user hits Back/Forward.
    // But if we sync while typing, it might jump.
    // We'll rely on the fact that navigate replaces the URL with the current query, so it matches.
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
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => query.length >= 2 && setShowSuggestions(true)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search songs, albums, artists..."
                        className="block w-full pl-10 pr-3 py-2.5 border border-transparent rounded-lg leading-5 bg-white/10 text-gray-300 placeholder-gray-400 focus:outline-none focus:bg-white/20 focus:text-white sm:text-sm transition-all duration-200"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => { setQuery(''); setSuggestions([]); }}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                        >
                            <X size={16} />
                        </button>
                    )}

                    {/* Typeahead Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-retro-surface border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50">
                            {suggestions.map((track, index) => (
                                <div
                                    key={track.id}
                                    onClick={() => handleSuggestionClick(track)}
                                    className={`flex items-center space-x-3 p-3 cursor-pointer transition-colors group ${index === selectedIndex ? 'bg-white/20' : 'hover:bg-white/10'}`}
                                >
                                    <img src={track.thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-medium text-white truncate group-hover:text-retro-primary">{track.title}</h4>
                                        <p className="text-xs text-gray-400 truncate">{track.artist}</p>
                                    </div>
                                    <button className="p-2 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110">
                                        <Play size={16} fill="white" />
                                    </button>
                                </div>
                            ))}
                            <div
                                onClick={handleSearch}
                                className="p-3 text-center text-sm text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer border-t border-white/5"
                            >
                                View all results for "{query}"
                            </div>
                        </div>
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
