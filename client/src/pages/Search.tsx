import { useState, useEffect } from 'react';
import { Play, Plus, ListPlus, User, Disc, Music, Search as SearchIconLucide } from 'lucide-react';

import { useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { usePlayerStore, type Track } from '../store/usePlayerStore';

interface SearchResultItem {
    type: 'track' | 'artist' | 'album' | 'playlist';
    id: string;
    pipedId?: string;
    title: string;
    subtitle?: string;
    thumbnail?: string;
    score?: number;
    action?: 'play' | 'navigate';
    data?: any;
}

interface SearchResponse {
    tracks: SearchResultItem[];
    artists: SearchResultItem[];
    albums: SearchResultItem[];
    playlists: SearchResultItem[];
}

export const Search = () => {
    const [data, setData] = useState<SearchResponse>({ tracks: [], artists: [], albums: [], playlists: [] });
    const [loading, setLoading] = useState(false);
    const { token } = useAuthStore();
    const { playTrack, addToQueue } = usePlayerStore();
    const location = useLocation();

    // Playlist Modal State (Simplified for now, can be re-added if needed)
    // const [showPlaylistModal, setShowPlaylistModal] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const q = params.get('q');
        if (q) {
            performSearch(q);
        } else {
            setData({ tracks: [], artists: [], albums: [], playlists: [] });
        }
    }, [location.search]);

    const performSearch = async (searchQuery: string) => {
        if (!searchQuery.trim()) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const responseData = await res.json();
            setData(responseData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handlePlay = (item: SearchResultItem) => {
        if (item.type !== 'track') return;

        // Construct track object compatible with player
        const track: Track = {
            url: `/api/music/streams/${item.pipedId || item.id}`,
            title: item.title,
            thumbnail: item.thumbnail || '',
            uploaderName: item.subtitle || 'Unknown Artist',
            duration: 0, // We might not have duration in search results yet
            artistId: undefined,
            type: 'song'
        };
        playTrack(track);
    };

    const SectionHeader = ({ title, icon: Icon }: { title: string, icon: any }) => (
        <div className="flex items-center space-x-2 mb-4">
            <Icon className="text-retro-primary" size={24} />
            <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-pulse flex flex-col items-center space-y-4">
                    <div className="w-12 h-12 rounded-full border-4 border-retro-primary border-t-transparent animate-spin"></div>
                    <p className="text-gray-400 font-medium">Searching the universe...</p>
                </div>
            </div>
        );
    }

    const hasResults = data.tracks.length > 0 || data.artists.length > 0 || data.albums.length > 0 || data.playlists.length > 0;

    if (!hasResults && !loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center">
                <SearchIconLucide size={48} className="text-gray-600 mb-4" />
                <h3 className="text-xl font-bold text-gray-300">No results found</h3>
                <p className="text-gray-500 mt-2">Try searching for a song, artist, or album.</p>
            </div>
        );
    }


    return (
        <div className="space-y-10 pb-20">
            {/* Artists Section - Horizontal Grid */}
            {data.artists.length > 0 && (
                <section>
                    <SectionHeader title="Artists" icon={User} />
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {data.artists.map((artist, index) => (
                            <Link
                                to={`/artist/${artist.pipedId || artist.id}`}
                                key={`${artist.id}-${index}`}
                                className="group flex flex-col items-center text-center space-y-3"
                            >
                                <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden shadow-lg group-hover:scale-105 transition-transform duration-300 border-2 border-transparent group-hover:border-retro-primary">
                                    <img src={artist.thumbnail} alt={artist.title} className="w-full h-full object-cover" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white group-hover:text-retro-primary transition-colors truncate w-full">{artist.title}</h3>
                                    <p className="text-sm text-gray-400">Artist</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Songs Section - Vertical List */}
            {data.tracks.length > 0 && (
                <section>
                    <SectionHeader title="Songs" icon={Music} />
                    <div className="bg-white/5 rounded-xl overflow-hidden border border-white/5">
                        {data.tracks.map((track, index) => (
                            <div
                                key={`${track.id}-${index}`}
                                onClick={() => handlePlay(track)}
                                className="group flex items-center p-3 hover:bg-white/10 transition-colors cursor-pointer border-b border-white/5 last:border-0"
                            >
                                <div className="w-8 text-center text-gray-500 text-sm mr-4 group-hover:hidden">{index + 1}</div>
                                <div className="w-8 text-center hidden group-hover:block mr-4">
                                    <Play size={16} className="text-white mx-auto" fill="white" />
                                </div>

                                <img src={track.thumbnail} alt={track.title} className="w-10 h-10 rounded object-cover shadow-sm mr-4" />

                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-white truncate group-hover:text-retro-primary transition-colors">{track.title}</h4>
                                    <p className="text-sm text-gray-400 truncate">{track.subtitle}</p>
                                </div>

                                <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity px-4">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); addToQueue({ ...track, uploaderName: track.subtitle, url: `/api/music/streams/${track.pipedId || track.id}` } as any); }}
                                        className="p-2 hover:bg-white/20 rounded-full text-gray-300 hover:text-white"
                                        title="Add to Queue"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Albums Section - Grid */}
            {data.albums.length > 0 && (
                <section>
                    <SectionHeader title="Albums" icon={Disc} />
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {data.albums.map((album, index) => (
                            <Link
                                to={`/library/playlist/${album.pipedId || album.id}`}
                                key={`${album.id}-${index}`}
                                className="group cursor-pointer"
                            >
                                <div className="relative aspect-square rounded-lg overflow-hidden shadow-lg mb-3 group-hover:shadow-retro-primary/20 transition-all">
                                    <img src={album.thumbnail} alt={album.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Play size={32} fill="white" className="text-white drop-shadow-lg" />
                                    </div>
                                </div>
                                <h3 className="font-bold text-white truncate group-hover:text-retro-primary transition-colors">{album.title}</h3>
                                <p className="text-sm text-gray-400 truncate">{album.subtitle}</p>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Playlists Section - Grid */}
            {data.playlists.length > 0 && (
                <section>
                    <SectionHeader title="Playlists" icon={ListPlus} />
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {data.playlists.map((playlist, index) => (
                            <Link
                                to={`/library/playlist/${playlist.pipedId || playlist.id}`}
                                key={`${playlist.id}-${index}`}
                                className="group cursor-pointer"
                            >
                                <div className="relative aspect-square rounded-lg overflow-hidden shadow-lg mb-3 group-hover:shadow-retro-primary/20 transition-all">
                                    <img src={playlist.thumbnail} alt={playlist.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                </div>
                                <h3 className="font-bold text-white truncate group-hover:text-retro-primary transition-colors">{playlist.title}</h3>
                                <p className="text-sm text-gray-400 truncate">{playlist.subtitle}</p>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

        </div>
    );
};
