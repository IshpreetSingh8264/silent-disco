import { useRoomStore } from '../../store/useRoomStore';
import { Trash2, Play, Music2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const RoomQueue = () => {
    const {
        queue,
        currentTrack,
        play,
        removeFromQueue,
        isHost
    } = useRoomStore();

    const upNext = queue.filter(t => !t.isPlayed);

    const handlePlay = (track: any) => {
        if (!isHost) {
            toast.error('Only host can change tracks');
            return;
        }
        play(track);
    };

    const handleRemove = (e: React.MouseEvent, queueId: string) => {
        e.stopPropagation();
        if (!isHost) return;
        removeFromQueue(queueId);
    };

    return (
        <div className="bg-black/20 rounded-3xl border border-white/5 overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-white/5 bg-white/5">
                <h2 className="text-xl font-bold font-display flex items-center gap-2">
                    <Music2 className="text-retro-primary" size={24} />
                    Queue
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10">
                {/* Now Playing */}
                {currentTrack && (
                    <section>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">Now Playing</h3>
                        <div className="bg-retro-primary/10 border border-retro-primary/20 rounded-xl p-3 flex items-center gap-3">
                            <div className="relative w-12 h-12 flex-shrink-0">
                                <img
                                    src={currentTrack.thumbnail}
                                    alt={currentTrack.title}
                                    className="w-full h-full object-cover rounded-lg"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                                    <div className="flex gap-0.5">
                                        <div className="w-1 h-3 bg-retro-primary animate-bounce" style={{ animationDelay: '0s' }} />
                                        <div className="w-1 h-3 bg-retro-primary animate-bounce" style={{ animationDelay: '0.1s' }} />
                                        <div className="w-1 h-3 bg-retro-primary animate-bounce" style={{ animationDelay: '0.2s' }} />
                                    </div>
                                </div>
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-bold text-white truncate">{currentTrack.title}</h4>
                                <p className="text-sm text-retro-primary truncate">{currentTrack.artist}</p>
                            </div>
                        </div>
                    </section>
                )}

                {/* Up Next */}
                <section>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2 flex justify-between">
                        <span>Up Next</span>
                        <span>{upNext.length}</span>
                    </h3>
                    <div className="space-y-1">
                        {upNext.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 bg-white/5 rounded-xl border border-white/5 border-dashed">
                                <p>Queue is empty</p>
                                <p className="text-xs mt-1">Search to add songs</p>
                            </div>
                        ) : (
                            upNext.map((track) => (
                                <div
                                    key={track.queueId}
                                    className="group flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                                    onClick={() => handlePlay(track)}
                                >
                                    <div className="relative w-10 h-10 flex-shrink-0">
                                        <img
                                            src={track.thumbnail}
                                            alt={track.title}
                                            className="w-full h-full object-cover rounded-lg"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                            <Play size={16} fill="white" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium text-gray-200 group-hover:text-white truncate text-sm">
                                            {track.title}
                                        </h4>
                                        <p className="text-xs text-gray-500 truncate">{track.artist}</p>
                                    </div>
                                    {isHost && (
                                        <button
                                            onClick={(e) => handleRemove(e, track.queueId)}
                                            className="p-2 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};
