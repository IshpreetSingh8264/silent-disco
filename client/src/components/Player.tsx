import { useState, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Link } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2, Heart, ListMusic, Shuffle, ChevronDown, Trash2, History, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { useRoomStore } from '../store/useRoomStore';
import { Queue } from './Queue';
import { AddToPlaylistModal } from './modals/AddToPlaylistModal';
import { analytics } from '../services/analytics';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import toast from 'react-hot-toast';

export const Player = () => {
    // Local Player State
    const {
        currentTrack: localTrack, isPlaying: localIsPlaying, togglePlay: localTogglePlay, playTrack: localPlayTrack,
        isShuffle, toggleShuffle,
        playNext: localPlayNext, playPrevious: localPlayPrevious,
        removeFromQueue: localRemoveFromQueue, clearQueue: localClearQueue, playTrackFromQueue: localPlayTrackFromQueue
    } = usePlayerStore();

    const { user } = useAuthStore();

    // Room Player State
    const {
        roomCode,
        currentTrack: roomTrack,
        isPlaying: roomIsPlaying,
        play: roomPlay,
        pause: roomPause,
        isHost,
        seek: roomSeek,
        removeFromQueue: roomRemoveFromQueue,
        position: roomPosition,
        lastSyncTime,
        members,
        playNext: roomPlayNext,
        playPrevious: roomPlayPrevious,
        setPosition
    } = useRoomStore();

    // Determine active mode
    const isRoomMode = !!roomCode;
    const currentTrack = isRoomMode ? roomTrack : localTrack;
    const isPlaying = isRoomMode ? roomIsPlaying : localIsPlaying;

    // Get current member permissions
    const currentMember = isRoomMode ? members.find(m => m.userId === user?.id) : null;
    const canControlPlayback = isRoomMode ? (isHost || currentMember?.canControlPlayback) : true;
    const canManageQueue = isRoomMode ? (isHost || currentMember?.canManageQueue) : true;

    // Sync Effect for Room Mode - only seek when receiving sync events with significant drift
    useEffect(() => {
        if (isRoomMode && audioRef.current && roomPosition !== undefined) {
            const drift = Math.abs(audioRef.current.currentTime - roomPosition);
            // Only correct if drift is more than 2 seconds to avoid constant jumping
            if (drift > 2) {
                console.log(`[Player] Correcting drift of ${drift.toFixed(1)}s`);
                audioRef.current.currentTime = roomPosition;
            }
        }
    }, [isRoomMode, roomPosition, lastSyncTime]);

    // Derived Actions
    const togglePlay = () => {
        if (isRoomMode) {
            if (!canControlPlayback) {
                toast.error('You do not have permission to control playback');
                return;
            }
            if (isPlaying) roomPause();
            else if (currentTrack) roomPlay(currentTrack);
        } else {
            localTogglePlay();
        }
    };

    const playNext = () => {
        if (isRoomMode) {
            if (!canControlPlayback) {
                toast.error('You do not have permission to control playback');
                return;
            }
            roomPlayNext();
        } else {
            localPlayNext();
        }
    };

    const playPrevious = () => {
        if (isRoomMode) {
            if (!canControlPlayback) {
                toast.error('You do not have permission to control playback');
                return;
            }
            roomPlayPrevious();
        } else {
            localPlayPrevious();
        }
    };

    const queue = usePlayerStore(useShallow(state => [...state.queueExplicit, ...state.queueSystem, ...state.queueAI]));
    // For Room Mode, we should use roomQueue, but for now let's stick to local queue for expanded view or fix it later.
    // Actually, let's define upNext and history properly.
    const { queue: roomQueue } = useRoomStore();
    const activeQueue = isRoomMode ? roomQueue : queue;

    const upNext = activeQueue.filter(t => !t.isPlayed);
    const history = activeQueue.filter(t => t.isPlayed);

    const handleQueuePlay = (track: any) => {
        if (isRoomMode) {
            if (!canControlPlayback) {
                toast.error('You do not have permission to play tracks');
                return;
            }
            roomPlay(track);
        } else {
            localPlayTrackFromQueue(track.pipedId || track.id);
        }
    };

    const handleQueueRemove = (e: React.MouseEvent, track: any) => {
        e.stopPropagation();
        if (isRoomMode) {
            if (!canManageQueue) {
                toast.error('You do not have permission to manage queue');
                return;
            }
            if (track.queueId) roomRemoveFromQueue(track.queueId);
        } else {
            localRemoveFromQueue(track.queueId || track.id);
        }
    };

    const handleQueueClear = () => {
        if (isRoomMode) {
            if (!canManageQueue) return;
            toast.error('Clear queue not implemented for rooms');
        } else {
            localClearQueue();
        }
    };

    const [volume, setVolume] = useState(0.8);
    const [muted, setMuted] = useState(false);
    const [played, setPlayed] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isQueueOpen, setIsQueueOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('up next');
    const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);

    const { token } = useAuthStore();
    const [isLiked, setIsLiked] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const lastTrackedTime = useRef(0);

    useEffect(() => {
        if (currentTrack) {
            checkIfLiked();
            lastTrackedTime.current = 0; // Reset tracking on track change
        }
    }, [currentTrack]);

    useEffect(() => {
        if (audioRef.current) {
            if (isPlaying) {
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(() => {
                        // console.error("Playback failed:", error);
                    });
                }
            } else {
                audioRef.current.pause();
            }
        }
    }, [isPlaying, currentTrack]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = muted ? 0 : volume;
        }
    }, [volume, muted]);

    // Keyboard controls
    useKeyboardShortcuts({
        audioRef,
        volume,
        setVolume,
        muted,
        setMuted,
        isQueueOpen,
        setIsQueueOpen,
        isExpanded,
        setIsExpanded
    });

    const checkIfLiked = async () => {
        // Placeholder for liked check
    };

    const toggleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentTrack) return;

        try {
            const res = await fetch('/api/library/liked', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ track: currentTrack })
            });
            const data = await res.json();
            setIsLiked(data.liked);
        } catch (err) {
            console.error(err);
        }
    };

    if (!currentTrack) return null;

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            const currentTime = audioRef.current.currentTime;
            const duration = audioRef.current.duration || currentTrack.duration || 0;
            setPlayed(currentTime / duration);
            setDuration(duration);

            // Keep room store position in sync with audio playback
            if (isRoomMode) {
                setPosition(currentTime);
            }

            if (currentTime - lastTrackedTime.current > 30) {
                analytics.track('DWELL', {
                    trackId: currentTrack.id || currentTrack.pipedId,
                    value: currentTime,
                    metadata: { duration }
                });
                lastTrackedTime.current = currentTime;
            }
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isRoomMode && !canControlPlayback) return; // Guests cannot seek

        const newPlayed = parseFloat(e.target.value);
        setPlayed(newPlayed);
        if (audioRef.current) {
            const duration = audioRef.current.duration || currentTrack.duration || 0;
            const newTime = newPlayed * duration;
            audioRef.current.currentTime = newTime;

            if (isRoomMode && canControlPlayback) {
                roomSeek(newTime);
            }
        }
    };

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return "0:00";
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // Helper to safely access properties that might be missing on RoomQueueItem
    const getThumbnailHd = (track: any) => track.thumbnailHdUrl || track.thumbnail;
    const getArtistId = (track: any) => track.artistId;

    return (
        <>
            <div className={`fixed bottom-16 md:bottom-0 left-0 right-0 bg-retro-surface border-t border-white/10 z-50 transition-all duration-300 ${isExpanded ? 'h-screen bottom-0' : 'h-24'}`}>
                {/* Hidden Audio Element */}
                <audio
                    ref={audioRef}
                    src={currentTrack.url}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={playNext}
                    onLoadedMetadata={(e) => {
                        if (isPlaying) e.currentTarget.play().catch(console.error);
                    }}
                    onError={(e) => console.error("Audio error:", e.currentTarget.error, e.currentTarget.src)}
                />

                {/* Expanded View Content */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            drag="y"
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={0.2}
                            onDragEnd={(_, info) => {
                                if (info.offset.y > 100) setIsExpanded(false);
                            }}
                            className="fixed inset-0 bg-retro-bg z-40 flex flex-col md:flex-row pt-20 pb-24 px-8 md:px-16 space-y-8 md:space-y-0 md:space-x-16 overflow-hidden"
                        >
                            {/* Blurred Background */}
                            <div className="absolute inset-0 z-0">
                                <div className="absolute inset-0 bg-black/60 z-10" />
                                <img
                                    src={getThumbnailHd(currentTrack)}
                                    alt=""
                                    className="w-full h-full object-cover blur-3xl opacity-50 scale-110"
                                />
                            </div>

                            {/* Close Button */}
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="absolute top-6 left-6 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                            >
                                <ChevronDown size={24} />
                            </button>

                            {/* Left Side: Artwork & Main Info */}
                            <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full z-10">
                                <motion.div
                                    className="aspect-square w-full max-w-md relative shadow-2xl rounded-2xl overflow-hidden mb-8 cursor-pointer"
                                    onDoubleClick={() => setIsExpanded(false)}
                                    whileHover={{ scale: 1.02 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <img
                                        src={getThumbnailHd(currentTrack)}
                                        alt={currentTrack.title}
                                        className="w-full h-full object-cover"
                                    />
                                </motion.div>
                                <div className="w-full text-center md:text-left space-y-2">
                                    <h2 className="text-3xl md:text-5xl font-bold text-white truncate drop-shadow-lg">{currentTrack.title}</h2>
                                    {getArtistId(currentTrack) ? (
                                        <Link to={`/artist/${getArtistId(currentTrack)}`} className="text-xl md:text-2xl text-gray-200 drop-shadow-md hover:text-white hover:underline transition-all" onClick={() => setIsExpanded(false)}>
                                            {currentTrack.artist || currentTrack.uploaderName}
                                        </Link>
                                    ) : (
                                        <p className="text-xl md:text-2xl text-gray-200 drop-shadow-md">{currentTrack.artist || currentTrack.uploaderName}</p>
                                    )}
                                </div>
                                <div className="mt-8 flex space-x-6">
                                    <button onClick={toggleLike} className="p-4 rounded-full bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-md">
                                        <Heart size={28} fill={isLiked ? "white" : "none"} className={isLiked ? "text-retro-primary" : "text-white"} />
                                    </button>
                                    <button
                                        onClick={() => setShowAddToPlaylist(true)}
                                        className="p-4 rounded-full bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-md"
                                    >
                                        <ListMusic size={28} className="text-white" />
                                    </button>
                                </div>
                            </div>

                            {/* Right Side: Tabs (Up Next, Lyrics, Related) */}
                            <div className="flex-1 flex flex-col w-full max-w-xl mx-auto bg-black/40 rounded-3xl border border-white/10 overflow-hidden backdrop-blur-xl z-10 shadow-2xl">
                                <div className="flex border-b border-white/10">
                                    {['Up Next', 'Lyrics', 'Related'].map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab.toLowerCase())}
                                            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === tab.toLowerCase() ? 'bg-white/10 text-white border-b-2 border-retro-primary' : 'text-gray-400 hover:text-gray-200'}`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                    {activeTab === 'up next' && (
                                        <div className="space-y-6">
                                            {/* Up Next List */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Up Next ({upNext.length})</h3>
                                                    {upNext.length > 0 && (
                                                        <button
                                                            onClick={handleQueueClear}
                                                            className="text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded transition-colors"
                                                        >
                                                            Clear
                                                        </button>
                                                    )}
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
                                                                key={`${track.pipedId || track.id}-${i}`}
                                                                className="group flex items-center space-x-3 p-2 rounded-lg hover:bg-white/10 transition-all cursor-pointer border border-transparent hover:border-white/5"
                                                                onClick={() => handleQueuePlay(track)}
                                                            >
                                                                <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden">
                                                                    <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                                                                    <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center">
                                                                        <Play size={20} fill="white" />
                                                                    </div>
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className="font-medium truncate text-white text-sm group-hover:text-retro-primary transition-colors">{track.title}</h4>
                                                                    {getArtistId(track) ? (
                                                                        <Link to={`/artist/${getArtistId(track)}`} className="text-xs text-gray-400 truncate hover:text-white hover:underline block" onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}>
                                                                            {track.artist || track.uploaderName}
                                                                        </Link>
                                                                    ) : (
                                                                        <p className="text-xs text-gray-400 truncate">{track.artist || track.uploaderName}</p>
                                                                    )}
                                                                </div>
                                                                <span className="text-xs text-gray-500 font-mono group-hover:text-gray-300">{formatTime(track.duration || 0)}</span>
                                                                <button
                                                                    onClick={(e) => handleQueueRemove(e, track)}
                                                                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-all"
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
                                                    <div className="flex items-center space-x-2">
                                                        <History size={14} className="text-gray-500" />
                                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">History</h3>
                                                    </div>
                                                    <div className="space-y-1 opacity-60 hover:opacity-100 transition-opacity duration-300">
                                                        {history.map((track, i) => (
                                                            <div
                                                                key={`history-${i}`}
                                                                className="group flex items-center space-x-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                                                                onClick={() => localPlayTrack(track)}
                                                            >
                                                                <div className="relative w-10 h-10 flex-shrink-0 grayscale group-hover:grayscale-0 transition-all">
                                                                    <img src={track.thumbnail} alt="" className="w-full h-full rounded-md object-cover" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className="font-medium truncate text-white text-sm">{track.title}</h4>
                                                                    <p className="text-xs text-gray-400 truncate">{track.artist || track.uploaderName}</p>
                                                                </div>
                                                                <div className="text-xs text-gray-500 font-mono">
                                                                    {formatTime(track.duration || 0)}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'lyrics' && (
                                        <div className="flex items-center justify-center h-full text-gray-400">
                                            <p>Lyrics not available yet</p>
                                        </div>
                                    )}

                                    {activeTab === 'related' && (
                                        <div className="flex items-center justify-center h-full text-gray-400">
                                            <p>Related tracks coming soon...</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Controls Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-24 px-6 flex items-center justify-between bg-retro-surface/95 backdrop-blur-md z-50">
                    {/* Track Info */}
                    <div className="flex items-center space-x-4 w-1/3">
                        {!isExpanded && (
                            <img src={currentTrack.thumbnail} alt={currentTrack.title} className="w-14 h-14 rounded object-cover" />
                        )}
                        <div className="hidden md:block">
                            <h4 className="font-medium text-white truncate max-w-[200px]">{currentTrack.title}</h4>
                            {getArtistId(currentTrack) ? (
                                <Link to={`/artist/${getArtistId(currentTrack)}`} className="text-xs text-gray-400 hover:text-white hover:underline transition-colors">
                                    {currentTrack.uploaderName}
                                </Link>
                            ) : (
                                <p className="text-xs text-gray-400">{currentTrack.uploaderName}</p>
                            )}
                        </div>
                        <button onClick={toggleLike} className="hidden md:block text-gray-400 hover:text-retro-primary transition-colors">
                            <Heart size={20} fill={isLiked ? "currentColor" : "none"} className={isLiked ? "text-retro-primary" : ""} />
                        </button>
                        {isRoomMode && (
                            <div className="flex items-center space-x-2 px-3 py-1 bg-retro-primary/20 rounded-full border border-retro-primary/50">
                                <Radio size={14} className="text-retro-primary animate-pulse" />
                                <span className="text-xs font-bold text-retro-primary uppercase tracking-wider">Live Room</span>
                            </div>
                        )}
                    </div>

                    {/* Playback Controls */}
                    <div className="flex flex-col items-center w-1/3 space-y-2">
                        <div className="flex items-center space-x-6">
                            <button
                                onClick={toggleShuffle}
                                disabled={isRoomMode}
                                className={`text-gray-400 hover:text-white transition-colors ${isShuffle ? 'text-retro-primary' : ''} ${isRoomMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <Shuffle size={18} />
                            </button>
                            <button
                                onClick={playPrevious}
                                disabled={isRoomMode}
                                className={`text-gray-400 hover:text-white transition-colors ${isRoomMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <SkipBack size={20} />
                            </button>
                            <button
                                onClick={togglePlay}
                                disabled={isRoomMode && !canControlPlayback}
                                className={`w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform ${isRoomMode && !canControlPlayback ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-1" />}
                            </button>
                            <button
                                onClick={playNext}
                                disabled={isRoomMode && !canControlPlayback}
                                className={`text-gray-400 hover:text-white transition-colors ${isRoomMode && !canControlPlayback ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <SkipForward size={20} />
                            </button>
                            <button className="text-gray-400 hover:text-white transition-colors opacity-0 cursor-default">
                                <Shuffle size={18} /> {/* Spacer */}
                            </button>
                        </div>

                        <div className="flex items-center space-x-3 w-full max-w-md">
                            <span className="text-xs text-gray-400 w-10 text-right">{formatTime(played * (currentTrack.duration || duration || 0))}</span>
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step="any"
                                value={isNaN(played) ? 0 : played}
                                onChange={handleSeek}
                                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                            />
                            <span className="text-xs text-gray-400 w-10">{formatTime(currentTrack.duration || duration || 0)}</span>
                        </div>
                    </div>

                    {/* Volume & Extras */}
                    <div className="flex items-center justify-end space-x-4 w-1/3">
                        <button
                            onClick={() => setShowAddToPlaylist(true)}
                            className="text-gray-400 hover:text-white hidden md:block"
                            title="Add to Playlist"
                        >
                            <ListMusic size={20} />
                        </button>
                        <button onClick={() => setMuted(!muted)} className="text-gray-400 hover:text-white">
                            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step="0.01"
                            value={volume}
                            onChange={(e) => setVolume(parseFloat(e.target.value))}
                            className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer hidden md:block"
                        />
                        {!isExpanded && (
                            <button
                                onClick={() => setIsQueueOpen(!isQueueOpen)}
                                className={`ml-4 transition-colors ${isQueueOpen ? 'text-retro-primary' : 'text-gray-400 hover:text-white'}`}
                            >
                                <ListMusic size={20} />
                            </button>
                        )}
                        <button onClick={() => setIsExpanded(!isExpanded)} className="text-gray-400 hover:text-white ml-4">
                            <Maximize2 size={20} />
                        </button>
                    </div>
                </div>
            </div>

            <Queue isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />
            {showAddToPlaylist && currentTrack && (
                <AddToPlaylistModal track={currentTrack} onClose={() => setShowAddToPlaylist(false)} />
            )}
        </>
    );
};
