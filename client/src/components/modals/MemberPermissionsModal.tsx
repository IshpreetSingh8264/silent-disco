import { X, Shield } from 'lucide-react';
import { useRoomStore, type RoomMember } from '../../store/useRoomStore';
import { motion } from 'framer-motion';

interface MemberPermissionsModalProps {
    member: RoomMember;
    onClose: () => void;
}

export const MemberPermissionsModal = ({ member, onClose }: MemberPermissionsModalProps) => {
    const { isHost, updatePermissions } = useRoomStore();

    const permissions = [
        { key: 'canAddQueue', label: 'Add to Queue', description: 'Can add songs to the room queue' },
        { key: 'canManageQueue', label: 'Manage Queue', description: 'Can remove and reorder songs' },
        { key: 'canControlPlayback', label: 'Control Playback', description: 'Can play, pause, and skip songs' },
    ];

    const handleToggle = (key: string, currentValue: boolean) => {
        if (!isHost) return;
        updatePermissions(member.id, { [key]: !currentValue });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-md bg-retro-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-bold">
                            {member.username[0].toUpperCase()}
                        </div>
                        <div>
                            <h3 className="font-bold text-white">{member.username}</h3>
                            <p className="text-xs text-gray-400">{member.role === 'HOST' ? 'Room Host' : 'Member'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {member.role === 'HOST' ? (
                        <div className="p-4 bg-retro-primary/10 border border-retro-primary/20 rounded-xl flex items-start gap-3">
                            <Shield className="text-retro-primary shrink-0 mt-1" size={20} />
                            <div>
                                <h4 className="text-sm font-bold text-retro-primary mb-1">Full Access</h4>
                                <p className="text-xs text-gray-400">The host has full control over the room and cannot be restricted.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {permissions.map((perm) => (
                                <div key={perm.key} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                    <div className="flex-1 mr-4">
                                        <h4 className="text-sm font-medium text-white mb-0.5">{perm.label}</h4>
                                        <p className="text-xs text-gray-500">{perm.description}</p>
                                    </div>
                                    <button
                                        onClick={() => handleToggle(perm.key, (member as any)[perm.key])}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${(member as any)[perm.key] ? 'bg-retro-primary' : 'bg-gray-700'
                                            }`}
                                    >
                                        <div
                                            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${(member as any)[perm.key] ? 'left-7' : 'left-1'
                                                }`}
                                        />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
