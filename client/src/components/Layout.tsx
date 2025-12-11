import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Library, PlayCircle, Users, Settings, Crown, LogOut, Shield, Copy } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { useRoomStore } from '../store/useRoomStore';
import { Player } from './Player';
import { Navbar } from './Navbar';
import { MemberPermissionsModal } from './modals/MemberPermissionsModal';
import toast from 'react-hot-toast';

const SidebarItem = ({ icon: Icon, label, to, isActive }: { icon: any, label: string, to: string, isActive: boolean }) => (
    <Link
        to={to}
        className={`flex items-center space-x-4 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200 group ${isActive ? 'bg-white/10 text-white font-medium' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
    >
        <Icon size={24} className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'} fill={isActive ? "currentColor" : "none"} />
        <span className="text-sm tracking-wide">{label}</span>
    </Link>
);

export const Layout = () => {
    const { logout } = useAuthStore();
    const { fetchQueue } = usePlayerStore();
    const { roomCode, members, isHost, disconnect } = useRoomStore();
    const location = useLocation();
    const navigate = useNavigate();
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

    const selectedMember = members.find(m => m.id === selectedMemberId) || null;

    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    // Close modal if member leaves
    useEffect(() => {
        if (selectedMemberId && !selectedMember) {
            setSelectedMemberId(null);
        }
    }, [members, selectedMemberId, selectedMember]);

    const isActive = (path: string) => location.pathname === path;

    const handleLeaveRoom = () => {
        disconnect();
        navigate('/');
        toast.success('Left room');
    };

    const copyRoomCode = () => {
        if (roomCode) {
            navigator.clipboard.writeText(roomCode);
            toast.success('Room code copied!');
        }
    };

    return (
        <div className="flex h-screen bg-retro-bg text-white overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-black flex flex-col border-r border-white/5 hidden md:flex relative z-20">
                <div className="p-6 flex items-center space-x-2 mb-2">
                    <div className="w-8 h-8 bg-retro-primary rounded-full flex items-center justify-center">
                        <PlayCircle fill="black" className="text-black" size={20} />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight">Silent Disco</h1>
                </div>

                <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
                    <SidebarItem icon={Home} label="Home" to="/" isActive={isActive('/')} />
                    <SidebarItem icon={Library} label="Library" to="/library" isActive={isActive('/library')} />

                    <div className="pt-6 pb-2 px-4">
                        <div className="h-px bg-white/10 w-full mb-4"></div>
                    </div>

                    {!roomCode ? (
                        <SidebarItem icon={Users} label="Rooms" to="/rooms" isActive={isActive('/rooms')} />
                    ) : (
                        <div className="px-2 space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                            {/* Room Code Section */}
                            <div
                                onClick={copyRoomCode}
                                className="group p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer transition-all"
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-xs text-gray-400 uppercase tracking-wider">Room Code</p>
                                    <Copy size={12} className="text-gray-500 group-hover:text-white transition-colors" />
                                </div>
                                <p className="text-2xl font-mono font-bold text-retro-primary tracking-widest">{roomCode}</p>
                            </div>

                            {/* Members List */}
                            <div>
                                <div className="flex items-center justify-between mb-3 px-2">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Members ({members.length})</h3>
                                </div>
                                <div className="space-y-1">
                                    {members.map((member) => (
                                        <div
                                            key={member.id}
                                            onClick={() => isHost && setSelectedMemberId(member.id)}
                                            className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 group cursor-pointer transition-colors"
                                        >
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-bold ring-2 ring-black">
                                                    {member.username[0].toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-white flex items-center gap-2">
                                                        {member.username}
                                                        {member.role === 'HOST' && <Crown size={12} className="text-yellow-400 fill-yellow-400" />}
                                                    </span>
                                                </div>
                                            </div>
                                            {isHost && member.role !== 'HOST' && (
                                                <Shield size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Leave Button */}
                            <button
                                onClick={handleLeaveRoom}
                                className="flex items-center space-x-3 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg w-full transition-colors mt-4"
                            >
                                <LogOut size={20} />
                                <span className="text-sm font-medium">Leave Room</span>
                            </button>
                        </div>
                    )}
                </nav>

                {!roomCode && (
                    <div className="p-4 border-t border-white/5 mt-auto">
                        <button onClick={logout} className="flex items-center space-x-4 px-4 py-3 hover:bg-white/5 rounded-lg w-full text-left text-gray-400 hover:text-white transition-colors">
                            <Settings size={24} />
                            <span className="text-sm font-medium">Logout</span>
                        </button>
                    </div>
                )}
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                <Navbar />

                <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    <Outlet />
                    <div className="h-32"></div> {/* Spacer for Player */}
                </main>
            </div>

            {/* Player Bar */}
            <Player />

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-black border-t border-white/10 flex items-center justify-around z-50 pb-safe">
                <Link to="/" className={`flex flex-col items-center space-y-1 ${isActive('/') ? 'text-white' : 'text-gray-500'}`}>
                    <Home size={24} fill={isActive('/') ? "currentColor" : "none"} />
                    <span className="text-[10px] font-medium">Home</span>
                </Link>
                <Link to="/library" className={`flex flex-col items-center space-y-1 ${isActive('/library') ? 'text-white' : 'text-gray-500'}`}>
                    <Library size={24} fill={isActive('/library') ? "currentColor" : "none"} />
                    <span className="text-[10px] font-medium">Library</span>
                </Link>
            </div>

            {/* Modals */}
            {selectedMember && (
                <MemberPermissionsModal
                    member={selectedMember}
                    onClose={() => setSelectedMemberId(null)}
                />
            )}
        </div>
    );
};
