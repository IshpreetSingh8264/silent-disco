import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Link } from 'react-router-dom';
import { Heart, Music, Plus, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

interface Playlist {
    id: string;
    name: string;
    _count: { tracks: number };
}

export const Library = () => {
    const { token } = useAuthStore();
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPlaylists();
    }, [token]);

    const fetchPlaylists = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/library/playlists`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setPlaylists(data);
        } catch (err) {
            console.error(err);
        }
    };

    const createPlaylist = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/api/library/playlists`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: newPlaylistName })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create playlist');
            }

            setNewPlaylistName('');
            setShowCreateModal(false);
            fetchPlaylists();
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        }
    };

    const deletePlaylist = async (id: string) => {
        if (!confirm('Are you sure you want to delete this playlist?')) return;
        try {
            await fetch(`${API_BASE_URL}/api/library/playlists/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchPlaylists();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="space-y-8 p-8">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Your Library</h2>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-retro-primary text-black font-bold rounded-lg hover:scale-105 transition-transform"
                >
                    <Plus size={20} />
                    <span>New Playlist</span>
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {/* Liked Songs Card */}
                <Link to="/library/liked" className="group relative aspect-square bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl p-6 flex flex-col justify-end hover:scale-105 transition-transform shadow-lg">
                    <div className="absolute inset-0 flex items-center justify-center opacity-30 group-hover:opacity-50 transition-opacity">
                        <Heart size={64} fill="white" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-white">Liked Songs</h3>
                        <p className="text-white/80">Auto-generated</p>
                    </div>
                </Link>

                {/* Playlists */}
                {playlists.map(playlist => (
                    <Link key={playlist.id} to={`/library/playlist/${playlist.id}`} className="group relative aspect-square bg-retro-surface border border-white/10 rounded-xl p-6 flex flex-col justify-end hover:border-retro-primary/50 hover:scale-105 transition-all shadow-lg">
                        <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-40 transition-opacity">
                            <Music size={64} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white truncate">{playlist.name}</h3>
                            <p className="text-gray-400">{playlist._count.tracks} tracks</p>
                        </div>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                deletePlaylist(playlist.id);
                            }}
                            className="absolute top-2 right-2 p-2 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                        >
                            <Trash2 size={16} />
                        </button>
                    </Link>
                ))}
            </div>

            {/* Create Playlist Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-retro-surface p-8 rounded-2xl border border-white/10 w-full max-w-md">
                        <h3 className="text-2xl font-bold mb-6">Create Playlist</h3>
                        <form onSubmit={createPlaylist} className="space-y-4">
                            <input
                                type="text"
                                value={newPlaylistName}
                                onChange={(e) => setNewPlaylistName(e.target.value)}
                                placeholder="Playlist Name"
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-retro-primary"
                                autoFocus
                            />
                            {error && <p className="text-red-500 text-sm">{error}</p>}
                            <div className="flex justify-end space-x-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 text-gray-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!newPlaylistName.trim()}
                                    className="px-6 py-2 bg-retro-primary text-black font-bold rounded-lg hover:opacity-90 disabled:opacity-50"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
