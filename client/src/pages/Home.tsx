import { useState, useEffect, useRef } from 'react';
import { Play, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePlayerStore, type Track } from '../store/usePlayerStore';

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

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
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
                className="flex space-x-6 overflow-x-auto pb-8 px-2 scrollbar-none snap-x snap-mandatory"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {items.map((item) => (
                    <div
                        key={item.pipedId || item.url}
                        className="flex-none w-48 group relative snap-start"
                    >
                        <div className="aspect-square relative rounded-lg overflow-hidden shadow-lg bg-retro-surface mb-3">
                            <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
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
    const { token } = useAuthStore();
    const { playTrack, addToQueue } = usePlayerStore();

    useEffect(() => {
        fetchHomeData();
    }, []);

    const fetchHomeData = async () => {
        try {
            const res = await fetch('/api/music/home', {
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

    return (
        <div className="space-y-12 p-8 pb-32">
            {/* Hero / Greeting (Optional, can add later) */}

            {shelves.map((shelf, index) => (
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
