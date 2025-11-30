import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import type { Track } from '../../store/usePlayerStore';

interface AddToPlaylistModalProps {
    track: Track;
    onClose: () => void;
}

interface Playlist {
    id: string;
    name: string;
    _count: { tracks: number };
}

export const AddToPlaylistModal = ({ track, onClose }: AddToPlaylistModalProps) => {
    const { token } = useAuthStore();
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [loading, setLoading] = useState(true);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchPlaylists();
    }, []);

    const fetchPlaylists = async () => {
        try {
            const res = await fetch('/api/library/playlists', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setPlaylists(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const createPlaylist = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPlaylistName.trim()) return;
        setCreating(true);
        try {
            const res = await fetch('/api/library/playlists', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: newPlaylistName })
            });
            const playlist = await res.json();
            setPlaylists([...playlists, { ...playlist, _count: { tracks: 0 } }]);
            setNewPlaylistName('');
            // Auto add to the new playlist? Maybe.
        } catch (err) {
            console.error(err);
        } finally {
            setCreating(false);
        }
    };

    const addToPlaylist = async (playlistId: string) => {
        try {
            const res = await fetch(`/api/library/playlists/${playlistId}/tracks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ track })
            });
            if (res.ok) {
                onClose();
                // Show success toast (optional)
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-retro-surface w-full max-w-md rounded-2xl border border-white/10 overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="font-bold text-lg">Add to Playlist</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 border-b border-white/10">
                    <div className="flex items-center space-x-3 mb-4">
                        <img src={track.thumbnail} alt="" className="w-12 h-12 rounded object-cover" />
                        <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{track.title}</h4>
                            <p className="text-sm text-gray-400 truncate">{track.uploaderName}</p>
                        </div>
                    </div>

                    <form onSubmit={createPlaylist} className="flex space-x-2">
                        <input
                            type="text"
                            value={newPlaylistName}
                            onChange={(e) => setNewPlaylistName(e.target.value)}
                            placeholder="New playlist name"
                            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-retro-primary"
                        />
                        <button
                            type="submit"
                            disabled={!newPlaylistName.trim() || creating}
                            className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            <Plus size={18} />
                        </button>
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Loading...</div>
                    ) : (
                        <div className="space-y-1">
                            {playlists.map(playlist => (
                                <button
                                    key={playlist.id}
                                    onClick={() => addToPlaylist(playlist.id)}
                                    className="w-full flex items-center justify-between p-3 hover:bg-white/5 rounded-lg group transition-colors text-left"
                                >
                                    <span className="font-medium group-hover:text-white text-gray-300">{playlist.name}</span>
                                    <span className="text-xs text-gray-500">{playlist._count.tracks} songs</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
