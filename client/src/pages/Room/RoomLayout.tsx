import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useRoomStore } from '../../store/useRoomStore';
import { useAuthStore } from '../../store/useAuthStore';
import QueueList from '../../components/Room/QueueList';
import PlayerSync from '../../components/Room/PlayerSync';
import { Users, Share2, Settings } from 'lucide-react';

const RoomLayout: React.FC = () => {
    const { code } = useParams<{ code: string }>();
    const { user } = useAuthStore();
    const { connect, disconnect, members, roomCode, isHost } = useRoomStore();

    useEffect(() => {
        if (code && user) {
            connect(code, user.id);
        }
        return () => {
            disconnect();
        };
    }, [code, user, connect, disconnect]);

    if (!roomCode) {
        return <div className="flex items-center justify-center h-screen text-white">Joining Room...</div>;
    }

    return (
        <div className="flex flex-col h-screen bg-black text-white">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/50 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold">Room: {code}</h1>
                    <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded-full border border-purple-500/30">
                        {isHost ? 'HOST' : 'GUEST'}
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Users size={16} />
                        <span>{members.length}</span>
                    </div>
                    <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <Share2 size={20} />
                    </button>
                    {isHost && (
                        <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <Settings size={20} />
                        </button>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex overflow-hidden">
                {/* Left: Player & Visuals */}
                <div className="flex-1 flex flex-col relative">
                    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-purple-900/20 to-black">
                        {/* Visualizer Placeholder */}
                        <div className="w-64 h-64 rounded-full bg-purple-500/10 animate-pulse flex items-center justify-center">
                            <div className="w-48 h-48 rounded-full bg-purple-500/20 animate-ping" />
                        </div>
                    </div>

                    {/* Player Controls */}
                    <div className="p-6 border-t border-white/10 bg-black/80 backdrop-blur-xl">
                        <PlayerSync />
                    </div>
                </div>

                {/* Right: Queue & Chat */}
                <div className="w-96 border-l border-white/10 flex flex-col bg-black/40 backdrop-blur-md">
                    <div className="p-4 border-b border-white/10 font-medium">Queue</div>
                    <div className="flex-1 overflow-y-auto">
                        <QueueList />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default RoomLayout;
