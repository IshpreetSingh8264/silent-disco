import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../store/usePlayerStore';
import { useRoomStore } from '../store/useRoomStore';
import { useAuthStore } from '../store/useAuthStore';

interface UseKeyboardShortcutsProps {
    audioRef: React.RefObject<HTMLAudioElement | null>;
    volume: number;
    setVolume: (val: number) => void;
    muted: boolean;
    setMuted: (val: boolean) => void;
    isQueueOpen: boolean;
    setIsQueueOpen: (val: boolean) => void;
    isExpanded: boolean;
    setIsExpanded: (val: boolean) => void;
}

export const useKeyboardShortcuts = ({
    audioRef,
    volume,
    setVolume,
    muted,
    setMuted,
    isQueueOpen,
    setIsQueueOpen,
    isExpanded,
    setIsExpanded
}: UseKeyboardShortcutsProps) => {
    const { togglePlay: localTogglePlay, playNext: localPlayNext, playPrevious: localPlayPrevious } = usePlayerStore();
    const {
        roomCode,
        isPlaying: roomIsPlaying,
        currentTrack: roomCurrentTrack,
        play: roomPlay,
        pause: roomPause,
        seek: roomSeek,
        playNext: roomPlayNext,
        playPrevious: roomPlayPrevious,
        isHost,
        members,
        position: roomPosition
    } = useRoomStore();
    const { user } = useAuthStore();
    const navigate = useNavigate();

    const isRoomMode = !!roomCode;

    // Get current member permissions
    const currentMember = isRoomMode ? members.find(m => m.userId === user?.id) : null;
    const canControlPlayback = isRoomMode ? (isHost || currentMember?.canControlPlayback) : true;

    // Room-aware toggle play
    const togglePlay = () => {
        if (isRoomMode) {
            if (!canControlPlayback) return;
            if (roomIsPlaying) {
                roomPause();
            } else if (roomCurrentTrack) {
                roomPlay(roomCurrentTrack);
            }
        } else {
            localTogglePlay();
        }
    };

    // Room-aware next
    const playNext = () => {
        if (isRoomMode) {
            if (!canControlPlayback) return;
            roomPlayNext();
        } else {
            localPlayNext();
        }
    };

    // Room-aware previous
    const playPrevious = () => {
        if (isRoomMode) {
            if (!canControlPlayback) return;
            roomPlayPrevious();
        } else {
            localPlayPrevious();
        }
    };

    // Room-aware seek
    const seek = (delta: number) => {
        if (audioRef.current) {
            const newTime = Math.max(0, audioRef.current.currentTime + delta);
            audioRef.current.currentTime = newTime;

            if (isRoomMode && canControlPlayback) {
                roomSeek(newTime);
            }
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

            switch (e.key.toLowerCase()) {
                case ' ':
                case 'k':
                    e.preventDefault(); // Prevent scrolling
                    togglePlay();
                    break;
                case 'n':
                    if (e.shiftKey) playNext();
                    break;
                case 'p':
                    if (e.shiftKey) playPrevious();
                    break;
                case 'j':
                    seek(-10);
                    break;
                case 'l':
                    seek(10);
                    break;
                case 'arrowleft':
                    seek(-5);
                    break;
                case 'arrowright':
                    seek(5);
                    break;
                case 'arrowup':
                    e.preventDefault();
                    setVolume(Math.min(1, volume + 0.1));
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    setVolume(Math.max(0, volume - 0.1));
                    break;
                case 'm':
                    setMuted(!muted);
                    break;
                case 'f':
                    setIsExpanded(!isExpanded);
                    break;
                case 'escape':
                    if (isExpanded) setIsExpanded(false);
                    else if (isQueueOpen) setIsQueueOpen(false);
                    break;
                case 'q':
                    setIsQueueOpen(!isQueueOpen);
                    break;
                case 's':
                    e.preventDefault();
                    const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
                    if (searchInput) {
                        searchInput.focus();
                    } else {
                        navigate('/search');
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [audioRef, volume, setVolume, muted, setMuted, isQueueOpen, setIsQueueOpen, isExpanded, setIsExpanded,
        isRoomMode, roomIsPlaying, roomCurrentTrack, canControlPlayback, navigate, roomPosition]);
};
