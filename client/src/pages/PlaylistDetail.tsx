import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { usePlayerStore, type Track } from '../store/usePlayerStore';
import { Play, Clock, Heart, Trash2 } from 'lucide-react';

export const PlaylistDetail = () => {
    const { id } = useParams();
    const location = useLocation();
    const { token } = useAuthStore();
    const { playTrack, addToQueue } = usePlayerStore();
    const [tracks, setTracks] = useState<Track[]>([]);
    const [title, setTitle] = useState('');
    const isLiked = location.pathname === '/library/liked';

    useEffect(() => {
        fetchTracks();
    }, [id, token]);

    const fetchTracks = async () => {
        const endpoint = isLiked
            ? 'http://localhost:3000/api/library/liked'
            : `http://localhost:3000/api/library/playlists/${id}`;

        try {
            const res = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (isLiked) {
                setTracks(data.map((t: any) => ({
                    ...t,
                    url: `http://localhost:3000/api/music/streams/${t.pipedId}`,
                    thumbnail: t.thumbnailUrl,
                    uploaderName: t.artist
                })));
                setTitle('Liked Songs');
            } else {
                setTracks(data.tracks.map((t: any) => ({
                    ...t.track,
                    url: `http://localhost:3000/api/music/streams/${t.track.pipedId}`,
                    thumbnail: t.track.thumbnailUrl,
                    uploaderName: t.track.artist
                })));
                setTitle(data.name);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const playAll = () => {
        if (tracks.length > 0) {
            playTrack(tracks[0]);
            tracks.slice(1).forEach(t => addToQueue(t));
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const removeTrack = async (e: React.MouseEvent, trackId: string) => {
        e.stopPropagation();
        if (!confirm('Remove this song from playlist?')) return;
        try {
            await fetch(`http://localhost:3000/api/library/playlists/${id}/tracks/${trackId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchTracks();
        } catch (err) {
            console.error(err);
        }
    };

    const deletePlaylist = async () => {
        if (!confirm('Delete this playlist?')) return;
        try {
            await fetch(`http://localhost:3000/api/library/playlists/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            window.location.href = '/library';
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-end space-x-6 p-8 bg-gradient-to-b from-retro-primary/20 to-transparent">
                <div className={`w-52 h-52 shadow-2xl flex items-center justify-center rounded-lg ${isLiked ? 'bg-gradient-to-br from-purple-600 to-blue-600' : 'bg-retro-surface border border-white/10'}`}>
                    {isLiked ? <Heart size={80} fill="white" /> : <span className="text-6xl font-bold">{title[0]}</span>}
                </div>
                <div className="space-y-4">
                    <span className="uppercase text-sm font-bold tracking-wider text-white/80">{isLiked ? 'Playlist' : 'Playlist'}</span>
                    <h1 className="text-6xl font-bold text-white tracking-tight">{title}</h1>
                    <p className="text-gray-400 font-medium">{tracks.length} songs</p>
                </div>
            </div>

            {/* Actions */}
            <div className="px-8 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={playAll}
                        className="w-14 h-14 rounded-full bg-retro-primary flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-retro-primary/20"
                    >
                        <Play fill="black" className="ml-1" />
                    </button>
                </div>
                {!isLiked && (
                    <button
                        onClick={deletePlaylist}
                        className="px-4 py-2 border border-red-500/50 text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                        Delete Playlist
                    </button>
                )}
            </div>

            {/* Track List */}
            <div className="px-8 pb-24">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-gray-400 border-b border-white/10 text-sm uppercase tracking-wider">
                            <th className="pb-4 w-12">#</th>
                            <th className="pb-4">Title</th>
                            <th className="pb-4">Album</th>
                            <th className="pb-4 w-24"><Clock size={16} /></th>
                            {!isLiked && <th className="pb-4 w-12"></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {tracks.map((track, i) => (
                            <tr
                                key={track.id}
                                className="group hover:bg-white/5 transition-colors cursor-pointer rounded-lg"
                                onClick={() => playTrack(track)}
                            >
                                <td className="py-3 pl-2 text-gray-400 group-hover:text-white font-mono">{i + 1}</td>
                                <td className="py-3">
                                    <div className="flex items-center space-x-4">
                                        <img src={track.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover" />
                                        <div>
                                            <div className="text-white font-medium">{track.title}</div>
                                            <div className="text-sm text-gray-400">{track.artist}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3 text-gray-400">{track.album || '-'}</td>
                                <td className="py-3 text-gray-400 font-mono text-sm">{formatDuration(track.duration)}</td>
                                {!isLiked && (
                                    <td className="py-3 text-right pr-2">
                                        <button
                                            onClick={(e) => removeTrack(e, track.id!)}
                                            className="text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
