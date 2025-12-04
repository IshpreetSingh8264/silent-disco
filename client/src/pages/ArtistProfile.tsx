import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Play, Music, Disc, Calendar } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';

interface Artist {
    pipedId: string;
    name: string;
    thumbnailUrl: string;
    monthlyListeners?: number;
    subscribers?: string;
    description?: string;
    featuredOn?: any[];
    similarArtists?: any[];
    topSingles?: any[];
    topAlbums?: any[];
    topSongs?: any[];
}

interface Album {
    browseId: string;
    name: string;
    thumbnails: { url: string }[];
    year?: string;
}

interface Song {
    videoId: string;
    name: string;
    artists: { name: string; id: string }[];
    album?: { name: string; id: string };
    duration?: number;
    thumbnails: { url: string }[];
    year?: string; // Derived
}

export const ArtistProfile = () => {
    const { id } = useParams<{ id: string }>();
    const { playTrack, playPlaylist } = usePlayerStore();

    const [artist, setArtist] = useState<Artist | null>(null);
    const [topSongs, setTopSongs] = useState<Song[]>([]);
    const [allSongs, setAllSongs] = useState<Song[]>([]);
    const [albums, setAlbums] = useState<Album[]>([]);

    const [activeTab, setActiveTab] = useState<'popular' | 'latest' | 'all'>('popular');
    const [loading, setLoading] = useState(true);

    // Pagination / "More" states
    const [visiblePopular, setVisiblePopular] = useState(5);
    const [visibleLatest, setVisibleLatest] = useState(10);
    const [visibleAll, setVisibleAll] = useState(20);

    useEffect(() => {
        const fetchArtistData = async () => {
            if (!id) return;
            setLoading(true);
            try {
                // 1. Fetch Artist Details
                const artistRes = await fetch(`/api/artists/${id}`);
                const artistData = artistRes.ok ? await artistRes.json() : null;
                setArtist(artistData);
                setTopSongs(artistData?.topSongs || []);

                // 2. Fetch Albums
                const albumsRes = await fetch(`/api/artists/${id}/albums`);
                const albumsData = albumsRes.ok ? await albumsRes.json() : { albums: [] };
                setAlbums(albumsData.albums || []);

                // 3. Fetch All Songs
                const songsRes = await fetch(`/api/artists/${id}/songs`);
                const songsData = songsRes.ok ? await songsRes.json() : { songs: [] };
                setAllSongs(songsData.songs || []);

            } catch (error) {
                console.error('Failed to fetch artist data', error);
            } finally {
                setLoading(false);
            }
        };

        fetchArtistData();
    }, [id]);

    // Derived State: Match Songs to Years
    const processedSongs = useMemo(() => {
        const albumYearMap = new Map<string, string>();

        // Add albums to map
        albums.forEach(a => {
            if (a.name && a.year) albumYearMap.set(a.name.toLowerCase(), a.year);
        });

        // Add singles to map (from artist object)
        if (artist?.topSingles) {
            artist.topSingles.forEach((s: any) => {
                if (s.name && s.year) albumYearMap.set(s.name.toLowerCase(), s.year);
            });
        }

        // Add topAlbums to map (from artist object)
        if (artist?.topAlbums) {
            artist.topAlbums.forEach((a: any) => {
                if (a.name && a.year) albumYearMap.set(a.name.toLowerCase(), a.year);
            });
        }

        return allSongs.map(song => {
            let year = 'Unknown Year';
            // Try matching by album name
            if (song.album?.name) {
                const y = albumYearMap.get(song.album.name.toLowerCase());
                if (y) year = y;
            }
            // Try matching by song name (if single)
            if (year === 'Unknown Year') {
                const y = albumYearMap.get(song.name.toLowerCase());
                if (y) year = y;
            }
            return { ...song, year };
        });
    }, [allSongs, albums, artist]);

    // Derived State: Grouped by Year for "All" tab
    const groupedSongs = useMemo(() => {
        const groups: Record<string, Song[]> = {};
        processedSongs.forEach(song => {
            const y = song.year || 'Unknown Year';
            if (!groups[y]) groups[y] = [];
            groups[y].push(song);
        });

        // Sort years descending
        return Object.entries(groups).sort((a, b) => {
            if (a[0] === 'Unknown Year') return 1;
            if (b[0] === 'Unknown Year') return -1;
            return b[0].localeCompare(a[0]);
        });
    }, [processedSongs]);

    // Derived State: Latest Songs (Sorted by Year/Recency)
    const latestSongs = useMemo(() => {
        return [...processedSongs].sort((a, b) => {
            const yearA = String(a.year === 'Unknown Year' ? '0' : a.year || '0');
            const yearB = String(b.year === 'Unknown Year' ? '0' : b.year || '0');
            return yearB.localeCompare(yearA);
        });
    }, [processedSongs]);


    const handlePlaySong = (song: Song, playlistContext?: Song[]) => {
        if (!song.videoId) return;

        // If context provided, use playPlaylist
        if (playlistContext && playlistContext.length > 0) {
            const tracks = playlistContext.map(s => ({
                id: s.videoId,
                pipedId: s.videoId,
                title: s.name,
                uploaderName: s.artists?.[0]?.name || artist?.name || 'Unknown',
                thumbnailUrl: s.thumbnails?.[s.thumbnails.length - 1]?.url || artist?.thumbnailUrl || '',
                thumbnail: s.thumbnails?.[s.thumbnails.length - 1]?.url || artist?.thumbnailUrl || '',
                duration: s.duration || 0,
                url: `/api/music/streams/${s.videoId}`
            }));
            const index = tracks.findIndex(t => t.id === song.videoId);
            playPlaylist(tracks, index !== -1 ? index : 0, 'artist');
        } else {
            // Fallback to single track play
            const thumbnailUrl = song.thumbnails?.[song.thumbnails.length - 1]?.url || artist?.thumbnailUrl || '';
            playTrack({
                id: song.videoId,
                pipedId: song.videoId,
                title: song.name,
                uploaderName: song.artists?.[0]?.name || artist?.name || 'Unknown',
                thumbnailUrl: thumbnailUrl,
                thumbnail: thumbnailUrl,
                duration: song.duration || 0,
                url: `/api/music/streams/${song.videoId}`
            });
        }
    };

    const handlePlayAlbum = async (albumId: string) => {
        if (!albumId) return;
        // Fetch album tracks
        try {
            const res = await fetch(`/api/albums/${albumId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.tracks && data.tracks.length > 0) {
                    const tracks = data.tracks.map((t: any) => ({
                        ...t,
                        thumbnail: t.thumbnail || t.thumbnailUrl // Normalize
                    }));

                    // Play using playPlaylist
                    playPlaylist(tracks, 0, 'album');
                }
            }
        } catch (e) {
            console.error("Failed to play album", e);
        }
    };

    if (loading) return <div className="flex items-center justify-center h-full text-white">Loading...</div>;
    if (!artist) return <div className="flex items-center justify-center h-full text-white">Artist not found</div>;

    return (
        <div className="min-h-full bg-retro-bg text-white pb-20">
            {/* Banner */}
            <div className="relative h-96 w-full overflow-hidden">
                <div className="absolute inset-0 bg-cover bg-center blur-sm opacity-50" style={{ backgroundImage: `url(${artist.thumbnailUrl})` }} />
                <div className="absolute inset-0 bg-gradient-to-t from-retro-bg via-retro-bg/60 to-transparent" />
                <div className="absolute bottom-0 left-0 p-8 flex items-end space-x-8">
                    <img src={artist.thumbnailUrl} alt={artist.name} className="w-48 h-48 rounded-full shadow-2xl border-4 border-retro-primary object-cover" />
                    <div className="mb-6">
                        <h1 className="text-6xl font-bold mb-2 tracking-tight">{artist.name}</h1>
                        <p className="text-gray-300 text-xl font-medium">{artist.subscribers ? `${artist.subscribers} Subscribers` : 'Artist'}</p>
                        {artist.description && <p className="text-gray-400 text-sm max-w-2xl mt-2 line-clamp-2">{artist.description}</p>}
                    </div>
                </div>
            </div>

            <div className="px-8 py-6 space-y-12">
                {/* Songs Section */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold flex items-center gap-2"><Music className="text-retro-primary" /> Songs</h2>
                        <div className="flex space-x-2 bg-white/5 p-1 rounded-lg">
                            {(['popular', 'latest', 'all'] as const).map((tab) => (
                                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-retro-primary text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        {activeTab === 'popular' && (
                            <>
                                {topSongs.slice(0, visiblePopular).map((song, index) => (
                                    <SongRow key={song.videoId} song={song} index={index} onClick={() => handlePlaySong(song, topSongs)} />
                                ))}
                                {topSongs.length > visiblePopular && (
                                    <button onClick={() => setVisiblePopular(prev => prev + 10)} className="w-full py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors">Show More</button>
                                )}
                            </>
                        )}

                        {activeTab === 'latest' && (
                            <>
                                {latestSongs.slice(0, visibleLatest).map((song, index) => (
                                    <SongRow key={song.videoId} song={song} index={index} onClick={() => handlePlaySong(song, latestSongs)} />
                                ))}
                                {latestSongs.length > visibleLatest && (
                                    <button onClick={() => setVisibleLatest(prev => prev + 10)} className="w-full py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors">Show More</button>
                                )}
                            </>
                        )}

                        {activeTab === 'all' && (
                            <div className="space-y-8">
                                {groupedSongs.slice(0, visibleAll).map(([year, songs]) => (
                                    <div key={year}>
                                        <h3 className="text-xl font-bold mb-4 text-gray-300 sticky top-0 bg-retro-bg/90 backdrop-blur py-2 z-10 flex items-center gap-2">
                                            <Calendar size={18} /> {year}
                                        </h3>
                                        <div className="space-y-1">
                                            {songs.map((song, i) => (
                                                <SongRow key={song.videoId} song={song} index={i} onClick={() => handlePlaySong(song, songs)} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {groupedSongs.length > visibleAll && (
                                    <button onClick={() => setVisibleAll(prev => prev + 5)} className="w-full py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors">Show More Years</button>
                                )}
                            </div>
                        )}
                    </div>
                </section>

                {/* Albums Section */}
                {albums.length > 0 && (
                    <section>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Disc className="text-retro-primary" /> Albums & EPs</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                            {albums.map((album) => (
                                <div key={album.browseId} className="group cursor-pointer" onClick={() => handlePlayAlbum(album.browseId)}>
                                    <div className="relative aspect-square mb-3 overflow-hidden rounded-lg shadow-lg">
                                        <img src={album.thumbnails?.[album.thumbnails.length - 1]?.url} alt={album.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <button className="p-4 rounded-full bg-retro-primary text-black transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 shadow-xl">
                                                <Play size={28} fill="currentColor" />
                                            </button>
                                        </div>
                                    </div>
                                    <h3 className="font-bold truncate group-hover:text-retro-primary transition-colors">{album.name}</h3>
                                    <p className="text-sm text-gray-400">{album.year || 'Album'}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Fans Also Like (Similar Artists) */}
                {artist.similarArtists && artist.similarArtists.length > 0 && (
                    <section>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Music className="text-retro-primary" /> Fans Also Like</h2>
                        <div className="flex overflow-x-auto space-x-6 pb-4 scrollbar-hide">
                            {artist.similarArtists
                                .filter((s: any) =>
                                    s.artistId &&
                                    s.name &&
                                    s.thumbnails?.length > 0 &&
                                    !s.artistId.startsWith('VL') && // Exclude View Lists (Playlists)
                                    !s.artistId.startsWith('PL')    // Exclude Playlists
                                )
                                .map((similar: any) => (
                                    <a
                                        key={similar.artistId} // Unique key
                                        href={`/artist/${similar.artistId}`}
                                        className="flex-shrink-0 w-40 group text-center"
                                    >
                                        <div className="relative w-40 h-40 mb-3 overflow-hidden rounded-full shadow-lg border-2 border-transparent group-hover:border-retro-primary transition-colors">
                                            <img
                                                src={similar.thumbnails?.[similar.thumbnails.length - 1]?.url}
                                                alt={similar.name}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                            />
                                        </div>
                                        <h3 className="font-bold truncate group-hover:text-retro-primary transition-colors">{similar.name}</h3>
                                    </a>
                                ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};

const SongRow = ({ song, index, onClick }: { song: Song; index: number; onClick: () => void }) => (
    <div className="flex items-center p-3 rounded-lg hover:bg-white/5 group transition-colors cursor-pointer" onClick={onClick}>
        <span className="w-8 text-gray-400 text-center font-mono">{index + 1}</span>
        <img src={song.thumbnails?.[0]?.url} alt={song.name} className="w-12 h-12 rounded ml-4 object-cover" />
        <div className="ml-4 flex-1">
            <div className="font-medium text-lg group-hover:text-retro-primary transition-colors">{song.name}</div>
            <div className="text-sm text-gray-400">{song.album?.name}</div>
        </div>
        <div className="text-gray-400 text-sm mr-4 font-mono">
            {song.duration ? `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}` : '--:--'}
        </div>
        <button className="p-3 rounded-full bg-retro-primary text-black opacity-0 group-hover:opacity-100 transition-opacity transform scale-90 group-hover:scale-100">
            <Play size={20} fill="currentColor" />
        </button>
    </div>
);
