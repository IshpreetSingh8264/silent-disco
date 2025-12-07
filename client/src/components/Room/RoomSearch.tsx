import { useState, useEffect, useRef } from 'react';
import { Search, Plus, X, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useRoomStore } from '../../store/useRoomStore';
import toast from 'react-hot-toast';

interface SearchResultItem {
    type: 'track' | 'artist' | 'album' | 'playlist';
    id: string;
    pipedId?: string;
    title: string;
    subtitle?: string;
    thumbnail?: string;
}

export const RoomSearch = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResultItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const { token } = useAuthStore();
    const { addToQueue } = useRoomStore();
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim()) {
                performSearch(query);
            } else {
                setResults([]);
                setIsOpen(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query]);

    const performSearch = async (searchQuery: string) => {
        setLoading(true);
        setIsOpen(true);
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            // Filter only tracks for now
            setResults(data.tracks || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = (track: SearchResultItem) => {
        // if (!isHost) {
        //     toast.error('Only host can add songs (for now)');
        //     return;
        // }
        // Guests should be able to add to queue too, usually.

        addToQueue({
            pipedId: track.pipedId || track.id,
            title: track.title,
            artist: track.subtitle || 'Unknown',
            thumbnail: track.thumbnail || '',
            duration: 0, // Will be fetched by server
            url: `/api/music/streams/${track.pipedId || track.id}`,
            uploaderName: track.subtitle
        });
        toast.success('Added to queue');
        setQuery('');
        setIsOpen(false);
    };

    return (
        <div ref={wrapperRef} className="relative w-full max-w-2xl mx-auto z-50">
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search for songs to add..."
                    className="w-full bg-white/10 border border-white/10 rounded-full py-3 pl-12 pr-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-retro-primary/50 focus:bg-white/20 transition-all"
                />
                {query && (
                    <button
                        onClick={() => { setQuery(''); setIsOpen(false); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-retro-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                    {loading ? (
                        <div className="p-4 flex justify-center">
                            <Loader2 className="animate-spin text-retro-primary" />
                        </div>
                    ) : results.length > 0 ? (
                        <div className="divide-y divide-white/5">
                            {results.map((track) => (
                                <div
                                    key={track.id}
                                    className="p-3 flex items-center gap-3 hover:bg-white/5 transition-colors group"
                                >
                                    <img
                                        src={track.thumbnail}
                                        alt={track.title}
                                        className="w-10 h-10 rounded object-cover"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-white truncate">{track.title}</h4>
                                        <p className="text-sm text-gray-400 truncate">{track.subtitle}</p>
                                    </div>
                                    <button
                                        onClick={() => handleAdd(track)}
                                        className="p-2 bg-white/10 hover:bg-retro-primary rounded-full transition-colors text-white opacity-0 group-hover:opacity-100"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : query ? (
                        <div className="p-4 text-center text-gray-400">
                            No songs found
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
};
