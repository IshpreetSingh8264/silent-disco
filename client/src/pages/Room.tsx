import { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { useRoomStore } from '../store/useRoomStore';
import toast from 'react-hot-toast';

export const Room = () => {
    const { token, user } = useAuthStore();
    const [roomCode, setRoomCode] = useState('');
    const navigate = useNavigate();

    const { connect } = useRoomStore();

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
                if (user?.id) {
                    connect(data.code, user.id);
                    navigate('/');
                    toast.success('Room created!');
                }
            } else {
                toast.error('Failed to create room');
            }
        } catch (err) {
            console.error('Failed to create room', err);
            toast.error('Failed to create room');
        }
    };

    const joinRoom = (code: string) => {
        if (code && user?.id) {
            connect(code, user.id);
            navigate('/');
            toast.success('Joined room!');
        }
    };

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
