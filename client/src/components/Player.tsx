import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2, Heart, ListMusic, Shuffle } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { Queue } from './Queue';

export const Player = () => {
    const { currentTrack, isPlaying, togglePlay, playTrack, queue, removeFromQueue, addToQueue, isShuffle, toggleShuffle } = usePlayerStore();
    const [volume, setVolume] = useState(0.8);
    const [muted, setMuted] = useState(false);
    const [played, setPlayed] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isQueueOpen, setIsQueueOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('up next');

    const { token, socket } = useAuthStore();
    const [isLiked, setIsLiked] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Check if in a room
    const roomCode = location.pathname.startsWith('/rooms/') ? location.pathname.split('/')[2] : null;

    useEffect(() => {
        if (currentTrack) {
            checkIfLiked();
        }
    }, [currentTrack]);

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

    // Local Smart Queue Effect
    useEffect(() => {
        const checkLocalQueue = async () => {
            // Keep at least 5 songs in queue
            if (!roomCode && currentTrack && queue.length < 5) {
                console.log('[SmartQueue] Local queue low, fetching recommendations...');
                try {
                    const artist = currentTrack.uploaderName || ''; // Assuming uploaderName is artist
                    const res = await fetch(`/api/music/recommendations?seedTrackId=${currentTrack.pipedId}&seedTrackTitle=${encodeURIComponent(currentTrack.title)}&seedTrackArtist=${encodeURIComponent(artist)}&limit=10`);
                    const recommendations = await res.json();

                    // Filter out duplicates (check against current queue AND history if we had it, but for now just queue)
                    const newTracks = recommendations.filter((rec: any) =>
                        rec.pipedId !== currentTrack.pipedId &&
                        !queue.some(q => q.pipedId === rec.pipedId)
                    );

                    if (newTracks.length > 0) {
                        // Add up to 10
                        newTracks.forEach((track: any) => {
                            addToQueue({ ...track, id: track.pipedId });
                        });
                        console.log(`[SmartQueue] Added ${newTracks.length} tracks locally`);
                    }
                } catch (err) {
                    console.error('[SmartQueue] Failed to fetch recommendations', err);
                }
            }
        };

        checkLocalQueue();
    }, [queue.length, currentTrack, roomCode]);

    const playNext = () => {
        if (queue.length > 0) {
            let nextTrackIndex = 0;

            if (isShuffle) {
                nextTrackIndex = Math.floor(Math.random() * queue.length);
            }

            const nextTrack = queue[nextTrackIndex];

            if (roomCode && socket) {
                // ... (keep existing room logic)
                if ((nextTrack as any).queueId) {
                    socket.emit('queue_remove', { roomCode, queueId: (nextTrack as any).queueId });
                }
                socket.emit('play', { roomCode, track: nextTrack, position: 0 });
            } else {
                // Local playback
                playTrack(nextTrack);
                // Remove the specific played instance
                // If shuffle, we still remove it? Yes, usually.
                removeFromQueue((nextTrack as any).queueId || nextTrack.id);
            }
        } else {
            // No next track, maybe stop or loop?
            if (isPlaying) togglePlay();
        }
    };

    if (!currentTrack) return null;

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            const currentTime = audioRef.current.currentTime;
            const duration = audioRef.current.duration || currentTrack.duration || 0;
            setPlayed(currentTime / duration);
            setDuration(duration);
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
            <div className={`fixed bottom-0 left-0 right-0 bg-retro-surface border-t border-white/10 z-50 transition-all duration-300 ${isExpanded ? 'h-screen' : 'h-24'}`}>
                {/* Hidden Audio Element */}
                <audio
                    ref={audioRef}
                    src={currentTrack.url}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={playNext}
                    onLoadedMetadata={(e) => {
                        console.log("Audio loaded:", e.currentTarget.src);
                        if (isPlaying) e.currentTarget.play().catch(console.error);
                    }}
                    onError={(e) => console.error("Audio error:", e.currentTarget.error, e.currentTarget.src)}
                />

                {/* Expanded View Content */}
                {isExpanded && (
                    <div className="fixed inset-0 bg-retro-bg z-40 flex flex-col md:flex-row pt-20 pb-24 px-8 md:px-16 space-y-8 md:space-y-0 md:space-x-16 overflow-hidden">
                        {/* Left Side: Artwork & Main Info */}
                        <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
                            <div className="aspect-square w-full max-w-md relative shadow-2xl rounded-lg overflow-hidden mb-8">
                                <img src={currentTrack.thumbnail} alt={currentTrack.title} className="w-full h-full object-cover" />
                            </div>
                            <div className="w-full text-center md:text-left space-y-2">
                                <h2 className="text-3xl md:text-4xl font-bold text-white truncate">{currentTrack.title}</h2>
                                <p className="text-xl text-gray-400">{currentTrack.uploaderName}</p>
                            </div>
                            <div className="mt-8 flex space-x-4">
                                <button onClick={toggleLike} className="p-4 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
                                    <Heart size={24} fill={isLiked ? "white" : "none"} className={isLiked ? "text-retro-primary" : "text-white"} />
                                </button>
                                {/* Add more action buttons here (Share, Add to Playlist, etc.) */}
                            </div>
                        </div>

                        {/* Right Side: Tabs (Up Next, Lyrics, Related) */}
                        <div className="flex-1 flex flex-col w-full max-w-xl mx-auto bg-retro-surface/50 rounded-2xl border border-white/5 overflow-hidden backdrop-blur-sm">
                            <div className="flex border-b border-white/10">
                                {['Up Next', 'Lyrics', 'Related'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab.toLowerCase())}
                                        className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === tab.toLowerCase() ? 'bg-white/10 text-white border-b-2 border-retro-primary' : 'text-gray-500 hover:text-gray-300'}`}
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
                                                className={`flex items-center space-x-4 p-3 rounded-lg cursor-pointer group ${track.pipedId === currentTrack.pipedId ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                                onClick={() => playTrack(track)}
                                            >
                                                <div className="relative w-12 h-12 flex-shrink-0 rounded overflow-hidden">
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
                                                    <p className="text-sm text-gray-400 truncate">{track.uploaderName}</p>
                                                </div>
                                                <span className="text-xs text-gray-500">{formatTime(track.duration || 0)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeTab === 'lyrics' && (
                                    <div className="flex items-center justify-center h-full text-gray-500">
                                        <p>Lyrics not available yet</p>
                                    </div>
                                )}

                                {activeTab === 'related' && (
                                    <div className="flex items-center justify-center h-full text-gray-500">
                                        <p>Related tracks coming soon...</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Controls Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-24 px-6 flex items-center justify-between bg-retro-surface/95 backdrop-blur-md">
                    {/* Track Info */}
                    <div className="flex items-center space-x-4 w-1/3">
                        {!isExpanded && (
                            <img src={currentTrack.thumbnail} alt={currentTrack.title} className="w-14 h-14 rounded object-cover" />
                        )}
                        <div className="hidden md:block">
                            <h4 className="font-medium text-white truncate max-w-[200px]">{currentTrack.title}</h4>
                            <p className="text-xs text-gray-400">{currentTrack.uploaderName}</p>
                        </div>
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
                            <button className="text-gray-400 hover:text-white transition-colors">
                                <SkipBack size={20} />
                            </button>
                            <button
                                onClick={togglePlay}
                                className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
                            >
                                {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" className="ml-1" />}
                            </button>
                            <button
                                onClick={playNext}
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
                            className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                        />
                        <button
                            onClick={() => setIsQueueOpen(!isQueueOpen)}
                            className={`ml-4 transition-colors ${isQueueOpen ? 'text-retro-primary' : 'text-gray-400 hover:text-white'}`}
                        >
                            <ListMusic size={20} />
                        </button>
                        <button onClick={() => setIsExpanded(!isExpanded)} className="text-gray-400 hover:text-white ml-4">
                            <Maximize2 size={20} />
                        </button>
                    </div>
                </div>
            </div>

            <Queue isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />
        </>
    );
};
