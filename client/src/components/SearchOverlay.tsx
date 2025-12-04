import { useEffect, useState } from 'react';
import { Play, Search, ChevronRight, Music, User, Disc } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../store/usePlayerStore';

interface SearchItem {
    type: 'track' | 'artist' | 'album' | 'playlist';
    id: string;
    pipedId?: string;
    title: string;
    subtitle?: string;
    thumbnail?: string;
    score?: number;
    action?: 'play' | 'navigate';
    data?: any;
}

interface SearchSection {
    section: string;
    items: SearchItem[];
}

interface SearchOverlayProps {
    query: string;
    onClose: () => void;
    onClear: () => void;
}

export const SearchOverlay = ({ query, onClose }: SearchOverlayProps) => {
    const [sections, setSections] = useState<SearchSection[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const navigate = useNavigate();
    const { playTrack } = usePlayerStore();


    // Flatten items for keyboard navigation
    const flatItems = sections.flatMap(s => s.items);

    useEffect(() => {
        const fetchSuggestions = async () => {
            if (!query || query.length < 1) {
                setSections([]);
                return;
            }

            setLoading(true);
            try {
                const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(query)}`);
                const data = await res.json();
                if (data.results) {
                    setSections(data.results);
                } else {
                    setSections([]);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(fetchSuggestions, 150); // 150ms debounce
        return () => clearTimeout(timer);
    }, [query]);

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (flatItems.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, flatItems.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, -1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIndex >= 0) {
                    handleItemClick(flatItems[selectedIndex]);
                } else {
                    // If nothing selected, go to full search
                    navigate(`/search?q=${encodeURIComponent(query)}`);
                    onClose();
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [flatItems, selectedIndex, query, navigate, onClose]);

    const handleItemClick = (item: SearchItem) => {
        if (item.action === 'play' && item.data) {
            playTrack(item.data);
        } else if (item.type === 'artist') {
            navigate(`/artist/${item.pipedId || item.id}`);
        } else if (item.type === 'album' || item.type === 'playlist') {
            // Route both albums and playlists to the playlist detail page
            // The backend now handles Album IDs (MPREb, OLAK5uy) in the public playlist route
            navigate(`/library/playlist/${item.pipedId || item.id}`);
        }
        onClose();
    };

    if (!query) return null;

    return (
        <div className="absolute top-full left-0 right-0 mt-2 bg-retro-surface border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl">
            {loading && sections.length === 0 && (
                <div className="p-4 text-center text-gray-400 text-sm">Searching...</div>
            )}

            {!loading && sections.length === 0 && (
                <div className="p-4 text-center text-gray-400 text-sm">No results found</div>
            )}

            <div className="max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                {sections.map((section, sIdx) => (
                    <div key={section.section} className="mb-2">
                        <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0 bg-retro-surface/95 backdrop-blur z-10">
                            {section.section}
                        </div>
                        <div className="px-2">
                            {section.items.map((item, iIdx) => {
                                // Calculate global index
                                let globalIndex = 0;
                                for (let k = 0; k < sIdx; k++) globalIndex += sections[k].items.length;
                                globalIndex += iIdx;

                                const isSelected = globalIndex === selectedIndex;

                                return (
                                    <div
                                        key={`${item.id}-${iIdx}`}
                                        onClick={() => handleItemClick(item)}
                                        className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-all duration-200 group ${isSelected ? 'bg-white/10 scale-[1.01]' : 'hover:bg-white/5'}`}
                                    >

                                        <div className="relative w-12 h-12 flex-shrink-0">
                                            <img
                                                src={item.thumbnail || '/default-cover.png'}
                                                alt=""
                                                className={`w-full h-full object-cover shadow-lg ${item.type === 'artist' ? 'rounded-full' : 'rounded-md'}`}
                                            />
                                            {item.type === 'track' && (
                                                <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                    <Play size={20} fill="white" className="text-white" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h4 className={`text-sm font-medium truncate ${isSelected ? 'text-retro-primary' : 'text-white'}`}>
                                                {item.title}
                                            </h4>
                                            <div className="flex items-center space-x-2 text-xs text-gray-400">
                                                {item.type === 'artist' && <User size={12} />}
                                                {item.type === 'track' && <Music size={12} />}
                                                {item.type === 'album' && <Disc size={12} />}
                                                <span className="truncate">{item.subtitle}</span>
                                            </div>
                                        </div>

                                        {isSelected && (
                                            <div className="mr-2">
                                                <ChevronRight size={16} className="text-gray-400" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div
                onClick={() => {
                    navigate(`/search?q=${encodeURIComponent(query)}`);
                    onClose();
                }}
                className="p-3 bg-white/5 border-t border-white/5 text-center text-sm text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors flex items-center justify-center space-x-2"
            >
                <Search size={14} />
                <span>View all results for "{query}"</span>
            </div>
        </div>
    );
};
