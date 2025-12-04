import { useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Library, PlayCircle, Users, Settings } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { Player } from './Player';
import { Navbar } from './Navbar';

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
    const location = useLocation();

    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="flex h-screen bg-retro-bg text-white overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-black flex flex-col border-r border-white/5 hidden md:flex">
                <div className="p-6 flex items-center space-x-2 mb-2">
                    <div className="w-8 h-8 bg-retro-primary rounded-full flex items-center justify-center">
                        <PlayCircle fill="black" className="text-black" size={20} />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight">Silent Disco</h1>
                </div>

                <nav className="flex-1 px-3 space-y-1">
                    <SidebarItem icon={Home} label="Home" to="/" isActive={isActive('/')} />

                    <SidebarItem icon={Library} label="Library" to="/library" isActive={isActive('/library')} />

                    <div className="pt-6 pb-2 px-4">
                        <div className="h-px bg-white/10 w-full mb-4"></div>
                    </div>

                    <SidebarItem icon={Users} label="Rooms" to="/rooms" isActive={isActive('/rooms')} />
                </nav>

                <div className="p-4 border-t border-white/5">
                    <button onClick={logout} className="flex items-center space-x-4 px-4 py-3 hover:bg-white/5 rounded-lg w-full text-left text-gray-400 hover:text-white transition-colors">
                        <Settings size={24} />
                        <span className="text-sm font-medium">Logout</span>
                    </button>
                </div>
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
        </div>
    );
};
