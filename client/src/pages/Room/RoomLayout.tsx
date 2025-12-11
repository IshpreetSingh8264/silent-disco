import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useRoomStore } from '../../store/useRoomStore';
import { Copy, MessageSquare, Music } from 'lucide-react';
import toast from 'react-hot-toast';
import { RoomSearch } from '../../components/Room/RoomSearch';
import { RoomQueue } from '../../components/Room/RoomQueue';

export const RoomLayout = () => {
    const { code } = useParams();
    const { connect, currentTrack, isPlaying } = useRoomStore();

    useEffect(() => {
        if (code) {
            connect(code);
        }
    }, [code, connect]);

    const copyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success('Room link copied!');
    };

    return (
        <div className="h-full flex flex-col p-6 space-y-6">
            {/* Top Bar: Search & Invite */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1 max-w-2xl">
                    <RoomSearch />
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={copyLink}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white"
                        title="Invite Friends"
                    >
                        <Copy size={20} />
                    </button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
                {/* Left Column: Queue */}
                <div className="lg:col-span-4 h-full min-h-0 bg-black/20 rounded-3xl border border-white/5 overflow-hidden backdrop-blur-sm">
                    <RoomQueue />
                </div>

                {/* Right Column: Visualizer & Chat */}
                <div className="lg:col-span-8 h-full min-h-0 flex flex-col gap-6">
                    {/* Now Playing Visualizer Area */}
                    <div className="flex-1 bg-black/40 rounded-3xl border border-white/5 overflow-hidden relative group">
                        {currentTrack ? (
                            <>
                                {/* Background Blur */}
                                <div className="absolute inset-0 z-0">
                                    <img
                                        src={currentTrack.thumbnail}
                                        alt=""
                                        className="w-full h-full object-cover blur-3xl opacity-30 scale-110 transition-transform duration-[10s] ease-linear"
                                        style={{ transform: isPlaying ? 'scale(1.2)' : 'scale(1.1)' }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
                                </div>

                                {/* Content */}
                                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8 text-center">
                                    <div className={`relative w-64 h-64 mb-8 rounded-2xl overflow-hidden shadow-2xl transition-transform duration-700 ${isPlaying ? 'scale-105' : 'scale-100'}`}>
                                        <img
                                            src={currentTrack.thumbnail}
                                            alt={currentTrack.title}
                                            className="w-full h-full object-cover"
                                        />
                                        {/* Equalizer Overlay */}
                                        {isPlaying && (
                                            <div className="absolute inset-0 bg-black/20 flex items-end justify-center gap-1 pb-4">
                                                {[...Array(8)].map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className="w-2 bg-retro-primary rounded-t-full animate-bounce"
                                                        style={{
                                                            height: '40%',
                                                            animationDelay: `${i * 0.1}s`,
                                                            animationDuration: '0.8s'
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <h2 className="text-4xl font-bold text-white mb-2 drop-shadow-lg max-w-2xl truncate">{currentTrack.title}</h2>
                                    <p className="text-xl text-gray-200 drop-shadow-md">{currentTrack.artist}</p>
                                    <p className="text-sm text-gray-400 mt-2">Added by {currentTrack.uploaderName}</p>
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                    <Music size={48} className="opacity-50" />
                                </div>
                                <p className="text-lg font-medium">No track playing</p>
                                <p className="text-sm">Add songs to the queue to start the party</p>
                            </div>
                        )}
                    </div>

                    {/* Chat Placeholder */}
                    <div className="h-48 bg-black/20 rounded-3xl border border-white/5 p-4 flex flex-col">
                        <div className="flex items-center gap-2 mb-4 text-gray-400">
                            <MessageSquare size={18} />
                            <span className="text-sm font-bold uppercase tracking-wider">Room Chat</span>
                        </div>
                        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                            Chat coming soon...
                        </div>
                        <div className="mt-2">
                            <input
                                type="text"
                                disabled
                                placeholder="Type a message..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-500 cursor-not-allowed"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
