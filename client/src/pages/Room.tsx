import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { Users, Copy, Play } from 'lucide-react';

export const Room = () => {
    const { socket, user, token } = useAuthStore();
    const { currentTrack, playTrack, togglePlay, isPlaying, setQueue, setPlaying } = usePlayerStore();
    const [roomCode, setRoomCode] = useState('');
    const [joinedRoom, setJoinedRoom] = useState<string | null>(null);
    const [members, setMembers] = useState<{ id: string; username: string }[]>([]);

    useEffect(() => {
        if (!socket) return;

        socket.on('members_update', (updatedMembers: { id: string; username: string }[]) => {
            setMembers(updatedMembers);
        });

        socket.on('sync_state', (state: { isPlaying: boolean; position: number; track: any; queue: any[]; timestamp: number }) => {
            if (state.track) {
                playTrack(state.track);
                // TODO: Handle position sync (seek)
            }
            if (state.queue) {
                setQueue(state.queue);
            }
            if (state.isPlaying !== isPlaying) {
                setPlaying(state.isPlaying);
            }
        });

        socket.on('queue_update', (queue: any[]) => {
            setQueue(queue);
        });

        socket.on('play', ({ track }) => {
            playTrack(track);
        });

        socket.on('pause', () => {
            if (isPlaying) togglePlay();
        });

        socket.on('seek', ({ position }) => {
            // TODO: Handle seek
        });

        return () => {
            socket.off('members_update');
            socket.off('sync_state');
            socket.off('queue_update');
            socket.off('play');
            socket.off('pause');
            socket.off('seek');
        };
    }, [socket, playTrack, togglePlay, isPlaying, setQueue, setPlaying]);

    const createRoom = async () => {
        try {
            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: `${user?.username}'s Room` }),
            });
            const data = await res.json();
            if (data.code) {
                joinRoom(data.code);
            }
        } catch (err) {
            console.error('Failed to create room');
        }
    };

    const joinRoom = (code: string) => {
        if (!socket) return;
        socket.emit('join_room', { roomCode: code, userId: user?.id });
        setJoinedRoom(code);
        setRoomCode(code);
    };

    if (joinedRoom) {
        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold tracking-tight">Room: <span className="text-retro-primary">{joinedRoom}</span></h2>
                    <button
                        onClick={() => navigator.clipboard.writeText(joinedRoom)}
                        className="flex items-center space-x-2 px-4 py-2 bg-retro-surface rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <Copy size={18} />
                        <span>Copy Code</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Now Playing */}
                    <div className="md:col-span-2 bg-retro-surface/50 p-6 rounded-2xl border border-white/10">
                        <h3 className="text-xl font-bold mb-4 flex items-center space-x-2">
                            <Play size={24} className="text-retro-neon" />
                            <span>Now Playing</span>
                        </h3>
                        {currentTrack ? (
                            <div className="flex items-center space-x-6">
                                <img src={currentTrack.thumbnail} alt={currentTrack.title} className="w-32 h-32 rounded-lg object-cover shadow-lg" />
                                <div>
                                    <h4 className="text-2xl font-bold text-white mb-2">{currentTrack.title}</h4>
                                    <p className="text-lg text-gray-400">{currentTrack.uploaderName}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-gray-500 italic">No music playing. Search and add songs!</div>
                        )}
                    </div>

                    {/* Members */}
                    <div className="bg-retro-surface/50 p-6 rounded-2xl border border-white/10">
                        <h3 className="text-xl font-bold mb-4 flex items-center space-x-2">
                            <Users size={24} className="text-retro-secondary" />
                            <span>Members ({members.length})</span>
                        </h3>
                        <ul className="space-y-3">
                            {members.map((member) => (
                                <li key={member.id} className="flex items-center space-x-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-retro-primary to-retro-secondary flex items-center justify-center text-black font-bold text-xs">
                                        {member.username.slice(0, 2).toUpperCase()}
                                    </div>
                                    <span className="text-gray-300">{member.username}</span>
                                </li>
                            ))}
                            {members.length === 0 && <li className="text-gray-500 italic">Waiting for others...</li>}
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto text-center space-y-12 py-12">
            <div>
                <h2 className="text-4xl font-bold mb-4">Join the Party</h2>
                <p className="text-gray-400 text-lg">Create a room to host a silent disco or join a friend's room.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-8 bg-retro-surface/30 rounded-2xl border border-white/10 hover:border-retro-primary/50 transition-all group">
                    <h3 className="text-2xl font-bold mb-6">Create Room</h3>
                    <button
                        onClick={createRoom}
                        className="w-full py-4 bg-retro-primary text-black font-bold rounded-xl hover:scale-105 transition-transform"
                    >
                        Start Hosting
                    </button>
                </div>

                <div className="p-8 bg-retro-surface/30 rounded-2xl border border-white/10 hover:border-retro-secondary/50 transition-all group">
                    <h3 className="text-2xl font-bold mb-6">Join Room</h3>
                    <div className="space-y-4">
                        <input
                            type="text"
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                            placeholder="ENTER CODE"
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-center text-xl tracking-widest font-mono focus:outline-none focus:border-retro-secondary transition-colors"
                        />
                        <button
                            onClick={() => joinRoom(roomCode)}
                            disabled={!roomCode}
                            className="w-full py-4 bg-retro-secondary text-black font-bold rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                        >
                            Join
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
