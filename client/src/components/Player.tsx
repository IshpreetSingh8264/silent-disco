import { useState, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLocation } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2, Heart, ListMusic, Shuffle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { Queue } from './Queue';
import { AddToPlaylistModal } from './modals/AddToPlaylistModal';
import { analytics } from '../services/analytics';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

export const Player = () => {
    const {
        currentTrack, isPlaying, togglePlay, playTrack,
        isShuffle, toggleShuffle,
        playNext, playPrevious, checkSmartQueue
    } = usePlayerStore();

    const queue = usePlayerStore(useShallow(state => [...state.queueExplicit, ...state.queueSystem, ...state.queueAI]));

    const [volume, setVolume] = useState(0.8);
    const [muted, setMuted] = useState(false);
    const [played, setPlayed] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isQueueOpen, setIsQueueOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('up next');
    const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);

    const { token, socket } = useAuthStore();
    const [isLiked, setIsLiked] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const lastTrackedTime = useRef(0);
    const location = useLocation();

    // Check if in a room
    const roomCode = location.pathname.startsWith('/rooms/') ? location.pathname.split('/')[2] : null;

    useEffect(() => {
        if (currentTrack) {
            checkIfLiked();
            lastTrackedTime.current = 0; // Reset tracking on track change
            // Trigger smart queue check whenever track changes
            if (!roomCode) {
                checkSmartQueue();
            }
        }
    }, [currentTrack, roomCode]);

    useEffect(() => {
        if (audioRef.current) {
            if (isPlaying) {
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.error("Playback failed:", error);
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

    const handlePlayNext = () => {
        if (roomCode && socket) {
            // Room logic remains manual for now as it involves socket
            if (queue.length > 0) {
                let nextTrackIndex = 0;
                if (isShuffle) {
                    nextTrackIndex = Math.floor(Math.random() * queue.length);
                }
                const nextTrack = queue[nextTrackIndex];
                if ((nextTrack as any).queueId) {
                    socket.emit('queue_remove', { roomCode, queueId: (nextTrack as any).queueId });
                }
                socket.emit('play', { roomCode, track: nextTrack, position: 0 });
            }
        } else {
            playNext();
        }
    };

    if (!currentTrack) return null;

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            const currentTime = audioRef.current.currentTime;
            const duration = audioRef.current.duration || currentTrack.duration || 0;
            setPlayed(currentTime / duration);
            setDuration(duration);

            // Track DWELL every 30 seconds
            if (currentTime - lastTrackedTime.current > 30) {
                analytics.track('DWELL', {
                    trackId: currentTrack.id,
                    value: currentTime,
                    metadata: { duration }
                });
                lastTrackedTime.current = currentTime;
            }
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newPlayed = parseFloat(e.target.value);
        setPlayed(newPlayed);
        if (audioRef.current) {
            const duration = audioRef.current.duration || currentTrack.duration || 0;
            audioRef.current.currentTime = newPlayed * duration;
        }
    };

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return "0:00";
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return (
        <>
            <div className={`fixed bottom-16 md:bottom-0 left-0 right-0 bg-retro-surface border-t border-white/10 z-50 transition-all duration-300 ${isExpanded ? 'h-screen bottom-0' : 'h-24'}`}>
                {/* Hidden Audio Element */}
                <audio
                    ref={audioRef}
                    src={currentTrack.url}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handlePlayNext}
                    onLoadedMetadata={(e) => {
                        console.log("Audio loaded:", e.currentTarget.src);
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
                                    src={currentTrack.thumbnailHdUrl || currentTrack.thumbnail}
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
                                        src={currentTrack.thumbnailHdUrl || currentTrack.thumbnail}
                                        alt={currentTrack.title}
                                        className="w-full h-full object-cover"
                                    />
                                </motion.div>
                                <div className="w-full text-center md:text-left space-y-2">
                                    <h2 className="text-3xl md:text-5xl font-bold text-white truncate drop-shadow-lg">{currentTrack.title}</h2>
                                    <p className="text-xl md:text-2xl text-gray-200 drop-shadow-md">{currentTrack.artist || currentTrack.uploaderName}</p>
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
                                        <div className="space-y-2">
                                            {queue.map((track, i) => (
                                                <div
                                                    key={`${track.pipedId}-${i}`}
                                                    className={`flex items-center space-x-4 p-3 rounded-xl cursor-pointer group transition-all ${track.pipedId === currentTrack.pipedId ? 'bg-white/20' : 'hover:bg-white/10'}`}
                                                    onClick={() => playTrack(track)}
                                                >
                                                    <div className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden">
                                                        <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center">
                                                            <Play size={20} fill="white" />
                                                        </div>
                                                        {track.pipedId === currentTrack.pipedId && (
                                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                                <div className="w-1 h-3 bg-retro-primary animate-bounce mx-0.5" />
                                                                <div className="w-1 h-4 bg-retro-primary animate-bounce delay-75 mx-0.5" />
                                                                <div className="w-1 h-2 bg-retro-primary animate-bounce delay-150 mx-0.5" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className={`font-medium truncate ${track.pipedId === currentTrack.pipedId ? 'text-retro-primary' : 'text-white'}`}>{track.title}</h4>
                                                        <p className="text-sm text-gray-400 truncate">{track.artist || track.uploaderName}</p>
                                                    </div>
                                                    <span className="text-xs text-gray-500">{formatTime(track.duration || 0)}</span>
                                                </div>
                                            ))}
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
                            <p className="text-xs text-gray-400">{currentTrack.uploaderName}</p>
                        </div>
                        <button onClick={toggleLike} className="hidden md:block text-gray-400 hover:text-retro-primary transition-colors">
                            <Heart size={20} fill={isLiked ? "currentColor" : "none"} className={isLiked ? "text-retro-primary" : ""} />
                        </button>
                    </div>

                    {/* Playback Controls */}
                    <div className="flex flex-col items-center w-1/3 space-y-2">
                        <div className="flex items-center space-x-6">
                            <button
                                onClick={toggleShuffle}
                                className={`text-gray-400 hover:text-white transition-colors ${isShuffle ? 'text-retro-primary' : ''}`}
                            >
                                <Shuffle size={18} />
                            </button>
                            <button
                                onClick={playPrevious}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <SkipBack size={20} />
                            </button>
                            <button
                                onClick={togglePlay}
                                className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
                            >
                                {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-1" />}
                            </button>
                            <button
                                onClick={handlePlayNext}
                                className="text-gray-400 hover:text-white transition-colors"
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
