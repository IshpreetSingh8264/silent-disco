import { Outlet, Link } from 'react-router-dom';
import { Home, Search, Library, Users, Settings } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { Player } from './Player';

const SidebarItem = ({ icon: Icon, label, to }: { icon: any, label: string, to: string }) => (
    <Link to={to} className="flex items-center space-x-3 p-3 hover:bg-retro-surface rounded-lg cursor-pointer transition-colors text-gray-400 hover:text-white">
        <Icon size={24} />
        <span className="font-medium">{label}</span>
    </Link>
);

export const Layout = () => {
    const { logout } = useAuthStore();

    return (
        <div className="flex h-screen bg-retro-bg text-white overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-black p-6 flex flex-col border-r border-retro-surface">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-retro-primary tracking-tighter">SILENT DISCO</h1>
                </div>

                <nav className="flex-1 space-y-2">
                    <SidebarItem icon={Home} label="Home" to="/" />
                    <SidebarItem icon={Search} label="Search" to="/search" />
                    <SidebarItem icon={Library} label="Library" to="/library" />
                    <div className="pt-6">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 px-3">Social</h3>
                        <SidebarItem icon={Users} label="Rooms" to="/rooms" />
                    </div>
                </nav>

                <div className="pt-4 border-t border-retro-surface">
                    <button onClick={logout} className="flex items-center space-x-3 p-3 hover:bg-retro-surface rounded-lg w-full text-left text-gray-400 hover:text-white transition-colors">
                        <Settings size={24} />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-8 pb-32">
                <Outlet />
            </main>

            {/* Player Bar */}
            <Player />
        </div>
    );
};
