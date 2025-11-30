import { useState, useEffect } from 'react';
import { Play, TrendingUp, Music, Smile } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePlayerStore } from '../store/usePlayerStore';

// --- Components ---

const ExploreNav = () => {
    const items = [
        { icon: Music, label: "New releases" },
        { icon: TrendingUp, label: "Charts" },
        { icon: Smile, label: "Moods & genres" },
    ];

    return (
        <div className="flex space-x-4 mb-10">
            {items.map((item) => (
                <button key={item.label} className="flex items-center space-x-3 bg-white/10 hover:bg-white/20 px-6 py-4 rounded-lg transition-colors flex-1 max-w-xs border border-white/5">
                    <item.icon size={24} className="text-white" />
                    <span className="font-bold text-lg">{item.label}</span>
                </button>
            ))}
        </div>
    );
};

const MoodGrid = () => {
    const moods = [
        { label: "1990s", color: "border-l-4 border-green-400" },
        { label: "Focus", color: "border-l-4 border-white" },
        { label: "Indian pop", color: "border-l-4 border-green-500" },
        { label: "Romance", color: "border-l-4 border-red-500" },
        { label: "Party", color: "border-l-4 border-purple-500" },
        { label: "Monsoon", color: "border-l-4 border-yellow-500" },
        { label: "Sad", color: "border-l-4 border-gray-500" },
        { label: "Punjabi", color: "border-l-4 border-orange-500" },
        { label: "Workout", color: "border-l-4 border-orange-400" },
        { label: "Hindi", color: "border-l-4 border-yellow-400" },
    ];

    return (
        <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">Moods & genres</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {moods.map((mood) => (
                    <div key={mood.label} className={`h-16 bg-white/5 hover:bg-white/10 rounded-md flex items-center px-4 cursor-pointer transition-colors ${mood.color}`}>
                        <span className="font-medium text-white">{mood.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Reusing Shelf logic (simplified for Explore)
const Shelf = ({ title, items, onPlay }: { title: string, items: any[], onPlay: (item: any) => void }) => {
    if (!items || items.length === 0) return null;

    return (
        <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
            <div className="flex space-x-6 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
                {items.map((item) => (
                    <div key={item.pipedId || item.url} className="flex-none w-48 group relative snap-start">
                        <div className="aspect-square relative rounded-lg overflow-hidden shadow-lg bg-retro-surface mb-3">
                            <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button onClick={() => onPlay(item)} className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform shadow-xl">
                                    <Play size={24} fill="black" className="ml-1" />
                                </button>
                            </div>
                        </div>
                        <h3 className="font-bold text-white truncate text-sm">{item.title}</h3>
                        <p className="text-xs text-gray-400 truncate">{item.uploaderName}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const Explore = () => {
    const [newReleases, setNewReleases] = useState<any[]>([]);
    const { token } = useAuthStore();
    const { playTrack } = usePlayerStore();

    useEffect(() => {
        // Fetch some data to populate "New Releases" (reusing home data for now as mock)
        fetch('/api/music/home', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setNewReleases(data[0].items); // Just using the first shelf as "New Releases"
                }
            })
            .catch(console.error);
    }, [token]);

    const handlePlay = (item: any) => {
        playTrack({
            url: item.url,
            title: item.title,
            thumbnail: item.thumbnail,
            uploaderName: item.uploaderName,
            duration: item.duration,
            id: item.pipedId,
            pipedId: item.pipedId
        });
    };

    return (
        <div className="space-y-12 p-8 pb-32 max-w-[1800px] mx-auto">
            <ExploreNav />

            <Shelf title="New albums & singles" items={newReleases} onPlay={handlePlay} />

            <MoodGrid />
        </div>
    );
};
