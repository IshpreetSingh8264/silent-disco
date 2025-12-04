import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../store/usePlayerStore';

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
    const { togglePlay, playNext, playPrevious } = usePlayerStore();
    const navigate = useNavigate();

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
                    if (audioRef.current) audioRef.current.currentTime -= 10;
                    break;
                case 'l':
                    if (audioRef.current) audioRef.current.currentTime += 10;
                    break;
                case 'arrowleft':
                    if (audioRef.current) audioRef.current.currentTime -= 5;
                    break;
                case 'arrowright':
                    if (audioRef.current) audioRef.current.currentTime += 5;
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
                    // Focus search input - assuming it has a specific ID or we navigate
                    // For now, let's navigate to search if not there, or focus if present
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
    }, [audioRef, volume, setVolume, muted, setMuted, isQueueOpen, setIsQueueOpen, isExpanded, setIsExpanded, togglePlay, navigate]);
};
