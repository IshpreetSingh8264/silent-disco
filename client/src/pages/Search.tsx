import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, Play, Plus, ListPlus } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePlayerStore, type Track } from '../store/usePlayerStore';

export const Search = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const { token } = useAuthStore();
    const { playTrack, addToQueue } = usePlayerStore();

    // Playlist Modal State
    const [showPlaylistModal, setShowPlaylistModal] = useState(false);
    const [selectedTrack, setSelectedTrack] = useState<any>(null);
    const [playlists, setPlaylists] = useState<any[]>([]);

    useEffect(() => {
        if (showPlaylistModal) {
            fetchPlaylists();
        }
    }, [showPlaylistModal]);

    const fetchPlaylists = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/library/playlists', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setPlaylists(data);
        } catch (err) {
            console.error(err);
        }
    };

    const openPlaylistModal = (item: any) => {
        setSelectedTrack(item);
        setShowPlaylistModal(true);
    };

    const addToPlaylist = async (playlistId: string) => {
        if (!selectedTrack) return;

        const trackData = {
            pipedId: selectedTrack.url.split('/streams/')[1] || selectedTrack.url, // Fallback if url is just ID
            title: selectedTrack.title,
            artist: selectedTrack.uploaderName,
            thumbnailUrl: selectedTrack.thumbnail,
            duration: selectedTrack.duration
        };

        // If URL is full URL, extract ID. Piped search returns /streams/ID usually? 
        // Actually Piped search items usually have `url` as relative path like `/watch?v=ID`
        // Let's inspect what Piped returns. Usually it's `url: "/watch?v=..."`
        if (selectedTrack.url.includes('watch?v=')) {
            trackData.pipedId = selectedTrack.url.split('v=')[1];
        }

        try {
            await fetch(`http://localhost:3000/api/library/playlists/${playlistId}/tracks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ track: trackData })
            });
            setShowPlaylistModal(false);
            setSelectedTrack(null);
            // Optionally show success toast
        } catch (err) {
            console.error(err);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        try {
            const res = await fetch(`http://localhost:3000/api/music/search?q=${encodeURIComponent(query)}&filter=music_songs`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setResults(data.items || []);
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
        };
        playTrack(track);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Search</h2>

            <form onSubmit={handleSearch} className="relative">
                <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="What do you want to listen to?"
                    className="w-full bg-retro-surface border border-white/10 rounded-full py-4 pl-12 pr-6 text-white focus:outline-none focus:border-retro-primary focus:ring-1 focus:ring-retro-primary transition-all"
                />
            </form>

            <div className="space-y-4">
                {loading ? (
                    <div className="text-center text-gray-400 py-10">Searching...</div>
                ) : (
                    results.map((item) => (
                        <div key={item.url} className="flex items-center justify-between p-4 bg-retro-surface/50 rounded-lg hover:bg-retro-surface transition-colors group">
                            <div className="flex items-center space-x-4">
                                <img src={item.thumbnail} alt={item.title} className="w-12 h-12 rounded object-cover" />
                                <div>
                                    <h3 className="font-medium text-white group-hover:text-retro-primary transition-colors">{item.title}</h3>
                                    <p className="text-sm text-gray-400">{item.uploaderName}</p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handlePlay(item)} className="p-2 hover:bg-retro-primary hover:text-black rounded-full transition-colors">
                                    <Play size={20} />
                                </button>
                                <button onClick={() => addToQueue(item)} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Add to Queue">
                                    <Plus size={20} />
                                </button>
                                <button onClick={() => openPlaylistModal(item)} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Add to Playlist">
                                    <ListPlus size={20} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Playlist Selection Modal */}
            {
                showPlaylistModal && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                        <div className="bg-retro-surface p-6 rounded-2xl border border-white/10 w-full max-w-md max-h-[80vh] overflow-y-auto">
                            <h3 className="text-xl font-bold mb-4">Add to Playlist</h3>
                            <div className="space-y-2">
                                {playlists.map(playlist => (
                                    <button
                                        key={playlist.id}
                                        onClick={() => addToPlaylist(playlist.id)}
                                        className="w-full text-left p-3 hover:bg-white/10 rounded-lg flex justify-between items-center transition-colors"
                                    >
                                        <span className="font-medium">{playlist.name}</span>
                                        <span className="text-sm text-gray-400">{playlist._count.tracks} tracks</span>
                                    </button>
                                ))}
                                {playlists.length === 0 && (
                                    <p className="text-gray-400 text-center py-4">No playlists found. Create one in Library first.</p>
                                )}
                            </div>
                            <button
                                onClick={() => setShowPlaylistModal(false)}
                                className="mt-6 w-full py-2 text-gray-400 hover:text-white"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
