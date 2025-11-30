import { usePlayerStore } from '../store/usePlayerStore';
import { X, Trash2, Play, History, ListMusic } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import toast from 'react-hot-toast';
import { useShallow } from 'zustand/react/shallow';

interface QueueProps {
    isOpen: boolean;
    onClose: () => void;
}

export const Queue = ({ isOpen, onClose }: QueueProps) => {
    const { playTrack, playTrackFromQueue, removeFromQueue, clearQueue, currentTrack } = usePlayerStore();
    const queue = usePlayerStore(
        useShallow(state => [...state.queueExplicit, ...state.queueSystem, ...state.queueAI])
    );
    const { socket } = useAuthStore();
    const roomCode = location.pathname.startsWith('/rooms/') ? location.pathname.split('/')[2] : null;

    if (!isOpen) return null;

    const handlePlay = (track: any, isQueueItem = false) => {
        if (isQueueItem) {
            playTrackFromQueue(track.pipedId || track.id);
        } else {
            playTrack(track);
        }

        if (roomCode && socket) {
            socket.emit('play', { roomCode, track, position: 0 });
        }
    };

    const handleRemove = (e: React.MouseEvent, track: any) => {
        e.stopPropagation();
        if (roomCode && socket) {
            if (track.queueId) {
                socket.emit('queue_remove', { roomCode, queueId: track.queueId });
            }
        } else {
            removeFromQueue(track.queueId || track.id);
            toast.success('Removed from queue');
        }
    };

    const handleClear = () => {
        if (roomCode && socket) {
            toast.error('Clear queue not implemented for rooms yet');
        } else {
            clearQueue();
            toast.success('Queue cleared');
        }
    };

    const history = queue.filter(t => t.isPlayed);
    const upNext = queue.filter(t => !t.isPlayed);

    return (
        <div className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-black/60 backdrop-blur-2xl border-l border-white/10 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col font-sans">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5 backdrop-blur-md">
                <div className="flex items-center space-x-3">
                    <ListMusic className="text-retro-primary" size={24} />
                    <h2 className="text-xl font-bold text-white tracking-tight">Play Queue</h2>
                </div>
                <div className="flex items-center space-x-2">
                    {upNext.length > 0 && (
                        <button
                            onClick={handleClear}
                            className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-full transition-all"
                        >
                            Clear
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                {/* Now Playing (if not in queue list, but usually currentTrack is separate) */}
                {currentTrack && (
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold text-retro-primary uppercase tracking-widest px-2">Now Playing</h3>
                        <div className="bg-white/10 border border-white/10 p-4 rounded-xl flex items-center space-x-4 shadow-lg relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-r from-retro-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <img src={currentTrack.thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover shadow-md z-10" />
                            <div className="flex-1 min-w-0 z-10">
                                <h4 className="font-bold text-white truncate text-lg">{currentTrack.title}</h4>
                                <p className="text-sm text-gray-300 truncate">{currentTrack.uploaderName}</p>
                            </div>
                            <div className="w-6 h-6 flex items-center justify-center z-10">
                                <div className="flex space-x-1">
                                    <div className="w-1 h-3 bg-retro-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-1 h-5 bg-retro-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-1 h-4 bg-retro-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Up Next Section */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Up Next</h3>
                        <span className="text-xs text-gray-500">{upNext.length} tracks</span>
                    </div>

                    {upNext.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-gray-500 space-y-4 py-12 border-2 border-dashed border-white/5 rounded-xl">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                                <ListMusic size={32} className="opacity-50" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-medium text-gray-400">Queue is empty</p>
                                <p className="text-xs text-gray-600 mt-1">Add songs to keep the vibe alive</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {upNext.map((track, i) => (
                                <div
                                    key={`next-${i}`}
                                    className="group flex items-center space-x-3 p-2 rounded-lg hover:bg-white/10 transition-all cursor-pointer border border-transparent hover:border-white/5"
                                    onClick={() => handlePlay(track)}
                                >
                                    <div className="relative w-12 h-12 flex-shrink-0">
                                        <img src={track.thumbnail} alt="" className="w-full h-full rounded-md object-cover shadow-sm" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
                                            <Play size={20} fill="white" className="text-white" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium truncate text-white text-sm group-hover:text-retro-primary transition-colors">{track.title}</h4>
                                        <p className="text-xs text-gray-400 truncate">{track.uploaderName}</p>
                                    </div>
                                    <button
                                        onClick={(e) => handleRemove(e, track)}
                                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* History Section */}
                {history.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-white/5">
                        <div className="flex items-center space-x-2 px-2">
                            <History size={14} className="text-gray-500" />
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">History</h3>
                        </div>
                        <div className="space-y-1 opacity-60 hover:opacity-100 transition-opacity duration-300">
                            {history.map((track, i) => (
                                <div
                                    key={`history-${i}`}
                                    className="group flex items-center space-x-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                                    onClick={() => handlePlay(track)}
                                >
                                    <div className="relative w-10 h-10 flex-shrink-0 grayscale group-hover:grayscale-0 transition-all">
                                        <img src={track.thumbnail} alt="" className="w-full h-full rounded-md object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium truncate text-white text-sm">{track.title}</h4>
                                        <p className="text-xs text-gray-400 truncate">{track.uploaderName}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
