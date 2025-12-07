import { usePlayerStore } from '../store/usePlayerStore';
import { X, Trash2, Play, Clock, Music2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRoomStore } from '../store/useRoomStore';
import { motion, AnimatePresence } from 'framer-motion';

interface QueueProps {
    isOpen: boolean;
    onClose: () => void;
}

export const Queue = ({ isOpen, onClose }: QueueProps) => {
    // Local Store
    const {
        currentTrack: localTrack,
        queueExplicit,
        queueSystem,
        queueAI,
        playTrack: localPlayTrack,
        removeFromQueue: localRemoveFromQueue,
        clearQueue: localClearQueue,
        playTrackFromQueue: localPlayTrackFromQueue
    } = usePlayerStore();

    // Room Store
    const {
        roomCode,
        currentTrack: roomTrack,
        queue: roomQueue,
        play: roomPlay,
        removeFromQueue: roomRemoveFromQueue,
        isHost
    } = useRoomStore();

    const isRoomMode = !!roomCode;
    const currentTrack = isRoomMode ? roomTrack : localTrack;

    // Combine queues for display
    const queue = isRoomMode
        ? roomQueue
        : [...queueExplicit, ...queueSystem, ...queueAI];

    const history = queue.filter(t => t.isPlayed);
    const upNext = queue.filter(t => !t.isPlayed);

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handlePlay = (track: any, isQueueItem = false) => {
        if (isRoomMode) {
            if (!isHost) {
                toast.error('Only host can change tracks');
                return;
            }
            roomPlay(track);
        } else {
            if (isQueueItem) {
                localPlayTrackFromQueue(track.pipedId || track.id);
            } else {
                localPlayTrack(track);
            }
        }
    };

    const handleRemove = (e: React.MouseEvent, track: any) => {
        e.stopPropagation();
        if (isRoomMode) {
            if (!isHost) return;
            if (track.queueId) {
                roomRemoveFromQueue(track.queueId);
            }
        } else {
            localRemoveFromQueue(track.queueId || track.id);
            toast.success('Removed from queue');
        }
    };

    const handleClear = () => {
        if (isRoomMode) {
            toast.error('Clear queue not implemented for rooms yet');
        } else {
            localClearQueue();
            toast.success('Queue cleared');
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-24 w-full md:w-96 bg-retro-surface border-l border-white/10 z-[70] shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-retro-surface">
                            <div>
                                <h2 className="text-xl font-bold font-display">Queue</h2>
                                {isRoomMode && (
                                    <span className="text-xs font-bold text-retro-primary uppercase tracking-wider">Room Mode</span>
                                )}
                            </div>
                            <div className="flex items-center space-x-4">
                                <button
                                    onClick={handleClear}
                                    disabled={isRoomMode}
                                    className={`text-sm text-gray-400 hover:text-white transition-colors ${isRoomMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    Clear
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {/* Now Playing */}
                            {currentTrack && (
                                <section>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Now Playing</h3>
                                    <div className="bg-white/5 rounded-xl p-4 flex items-center space-x-4 border border-white/10">
                                        <div className="relative group w-16 h-16 flex-shrink-0">
                                            <img
                                                src={currentTrack.thumbnail}
                                                alt={currentTrack.title}
                                                className="w-full h-full object-cover rounded-lg shadow-lg"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                                <div className="w-4 h-4 space-x-1 flex items-center justify-center">
                                                    <div className="w-1 h-3 bg-retro-primary animate-bounce" style={{ animationDelay: '0s' }} />
                                                    <div className="w-1 h-3 bg-retro-primary animate-bounce" style={{ animationDelay: '0.1s' }} />
                                                    <div className="w-1 h-3 bg-retro-primary animate-bounce" style={{ animationDelay: '0.2s' }} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium truncate text-white">{currentTrack.title}</h4>
                                            <p className="text-sm text-gray-400 truncate">{currentTrack.artist}</p>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* Up Next */}
                            <section>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                                    <span>Up Next</span>
                                    <span className="text-retro-primary">{upNext.length} tracks</span>
                                </h3>
                                <div className="space-y-2">
                                    {upNext.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500">
                                            <Music2 size={32} className="mx-auto mb-2 opacity-50" />
                                            <p>Queue is empty</p>
                                        </div>
                                    ) : (
                                        upNext.map((track, i) => (
                                            <div
                                                key={`${track.id}-${i}`}
                                                className="group flex items-center space-x-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                                                onClick={() => handlePlay(track, true)}
                                            >
                                                <div className="relative w-10 h-10 flex-shrink-0">
                                                    <img
                                                        src={track.thumbnail}
                                                        alt={track.title}
                                                        className="w-full h-full object-cover rounded"
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                                                        <Play size={16} fill="white" />
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium truncate text-sm text-gray-200 group-hover:text-white">
                                                        {track.title}
                                                    </h4>
                                                    <p className="text-xs text-gray-500 truncate">{track.artist}</p>
                                                </div>
                                                <div className="flex items-center space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="text-xs text-gray-500">{formatDuration(track.duration)}</span>
                                                    {(!isRoomMode || isHost) && (
                                                        <button
                                                            onClick={(e) => handleRemove(e, track)}
                                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>

                            {/* History */}
                            {history.length > 0 && (
                                <section>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                                        <Clock size={12} className="mr-2" />
                                        History
                                    </h3>
                                    <div className="space-y-2 opacity-50 hover:opacity-100 transition-opacity">
                                        {history.map((track, i) => (
                                            <div key={`history-${track.id}-${i}`} className="flex items-center space-x-3 p-2">
                                                <img
                                                    src={track.thumbnail}
                                                    alt={track.title}
                                                    className="w-8 h-8 object-cover rounded grayscale"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium truncate text-sm text-gray-400">{track.title}</h4>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
