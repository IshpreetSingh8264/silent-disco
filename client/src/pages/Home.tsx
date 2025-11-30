import { useState, useEffect, useRef } from 'react';
import { Play, Plus, ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePlayerStore, type Track } from '../store/usePlayerStore';

// --- Components ---

const CategoryPills = () => {
    const categories = ["Energize", "Workout", "Relax", "Focus", "Commute", "Party", "Romance", "Sleep", "Podcasts"];
    return (
        <div className="flex space-x-3 overflow-x-auto pb-4 scrollbar-none">
            {categories.map(cat => (
                <button key={cat} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border border-white/5">
                    {cat}
                </button>
            ))}
        </div>
    );
};

const QuickPicksGrid = ({ items, onPlay }: { items: any[], onPlay: (item: any) => void }) => {
    // Display up to 16 items in a 4-row grid (4 columns on large screens)
    // Actually YTM "Quick Picks" is often a horizontal scroll of pages, but let's do a grid for now as requested
    // The screenshot shows 4 rows, maybe 3 columns visible.
    // Let's make it a responsive grid.
    if (!items || items.length === 0) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Quick picks</h2>
                <div className="flex space-x-2">
                    <button className="px-4 py-1.5 rounded-full border border-white/20 hover:bg-white/10 text-sm font-medium transition-colors">Play all</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.slice(0, 16).map((item, i) => (
                    <div key={i} className="group flex items-center space-x-3 p-2 rounded-md hover:bg-white/10 transition-colors cursor-pointer" onClick={() => onPlay(item)}>
                        <div className="relative w-16 h-16 flex-shrink-0">
                            <img
                                src={item.thumbnail || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop"}
                                alt=""
                                className="w-full h-full object-cover rounded-md"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-md">
                                <Play size={20} fill="white" />
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-white truncate">{item.title}</h3>
                            <p className="text-sm text-gray-400 truncate">{item.uploaderName}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface ShelfProps {
    title: string;
    items: any[];
    onPlay: (item: any) => void;
    onAddToQueue: (item: any) => void;
}

const Shelf = ({ title, items, onPlay, onAddToQueue }: ShelfProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const current = scrollRef.current;
            const scrollAmount = direction === 'left' ? -current.offsetWidth : current.offsetWidth;
            current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    if (!items || items.length === 0) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
                <div className="flex space-x-2">
                    <button onClick={() => scroll('left')} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                        <ChevronLeft size={24} />
                    </button>
                    <button onClick={() => scroll('right')} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                        <ChevronRight size={24} />
                    </button>
                </div>
            </div>

            <div
                ref={scrollRef}
                className="flex space-x-6 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {items.map((item) => (
                    <div
                        key={item.pipedId || item.url}
                        className="flex-none w-48 group relative snap-start"
                    >
                        <div className="aspect-square relative rounded-lg overflow-hidden shadow-lg bg-retro-surface mb-3">
                            <img
                                src={item.thumbnail || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop"}
                                alt={item.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                                <button
                                    onClick={() => onPlay(item)}
                                    className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform shadow-xl"
                                >
                                    <Play size={24} fill="black" className="ml-1" />
                                </button>
                                <button
                                    onClick={() => onAddToQueue(item)}
                                    className="p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>

                        <h3 className="font-bold text-white truncate text-sm hover:underline cursor-pointer">{item.title}</h3>
                        <p className="text-xs text-gray-400 truncate hover:text-white cursor-pointer">{item.uploaderName}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const Home = () => {
    const [shelves, setShelves] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { token, user } = useAuthStore();
    const { playTrack, addToQueue } = usePlayerStore();
    const [region, setRegion] = useState('US');
    const regions = [
        { code: 'US', name: 'United States' },
        { code: 'GB', name: 'United Kingdom' },
        { code: 'IN', name: 'India' },
        { code: 'CA', name: 'Canada' },
        { code: 'AU', name: 'Australia' },
        { code: 'JP', name: 'Japan' },
        { code: 'DE', name: 'Germany' },
        { code: 'FR', name: 'France' },
        { code: 'BR', name: 'Brazil' },
    ];

    useEffect(() => {
        fetchHomeData();
    }, [region]); // Refetch when region changes

    const fetchHomeData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/music/home?region=${region}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (Array.isArray(data)) {
                setShelves(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handlePlay = (item: any) => {
        const track: Track = {
            url: item.url,
            title: item.title,
            thumbnail: item.thumbnail,
            uploaderName: item.uploaderName,
            duration: item.duration,
            id: item.pipedId,
            pipedId: item.pipedId
        };
        playTrack(track);
    };

    const handleAddToQueue = (item: any) => {
        const track: Track = {
            url: item.url,
            title: item.title,
            thumbnail: item.thumbnail,
            uploaderName: item.uploaderName,
            duration: item.duration,
            id: item.pipedId,
            pipedId: item.pipedId
        };
        addToQueue(track);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="flex space-x-2 animate-pulse">
                    <div className="w-3 h-3 bg-retro-primary rounded-full"></div>
                    <div className="w-3 h-3 bg-retro-primary rounded-full animation-delay-200"></div>
                    <div className="w-3 h-3 bg-retro-primary rounded-full animation-delay-400"></div>
                </div>
            </div>
        );
    }

    // Find "Quick Picks" shelf
    const quickPicks = shelves.find(s => s.title === "Quick Picks");
    // Filter out Quick Picks from other shelves
    const otherShelves = shelves.filter(s => s.title !== "Quick Picks");

    return (
        <div className="space-y-10 p-8 pb-32 max-w-[1800px] mx-auto">
            {/* Header with Category Pills and Region Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CategoryPills />

                <div className="flex items-center space-x-2 min-w-fit">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Region</span>
                    <select
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:bg-white/10 transition-colors cursor-pointer"
                    >
                        {regions.map(r => (
                            <option key={r.code} value={r.code} className="bg-black text-white">{r.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Quick Picks Grid (using the first shelf's items) */}
            {quickPicks && (
                <QuickPicksGrid items={quickPicks.items} onPlay={handlePlay} />
            )}

            {/* Listen Again (User History - Placeholder or fetched) */}
            <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-bold">
                    {user?.username?.[0]?.toUpperCase()}
                </div>
                <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Listen again</p>
                    <h2 className="text-2xl font-bold text-white">{user?.username}</h2>
                </div>
            </div>
            {/* We can reuse Shelf for Listen Again if we had data, for now just showing other shelves */}

            {/* Other Shelves */}
            {otherShelves.map((shelf, index) => (
                <Shelf
                    key={index}
                    title={shelf.title}
                    items={shelf.items}
                    onPlay={handlePlay}
                    onAddToQueue={handleAddToQueue}
                />
            ))}
        </div>
    );
};
