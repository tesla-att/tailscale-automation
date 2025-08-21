import { memo } from 'react';

interface Device {
  id: string;
  hostname: string;
  user: string;
  online: boolean;
  last_seen: string;
}

interface EnhancedDeviceCardProps {
  device: Device;
  onClick?: () => void;
}

const EnhancedDeviceCard = memo(({ device, onClick }: EnhancedDeviceCardProps) => {
  return (
    <div 
      className={`
        group relative overflow-hidden rounded-2xl transition-all duration-500 ease-[var(--ease-spring)]
        transform hover:scale-[1.02] hover:shadow-xl cursor-pointer
        ${device.online 
          ? 'bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 border-2 border-green-200/60 hover:border-green-300' 
          : 'bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 border-2 border-gray-200/60 hover:border-gray-300'
        }
      `}
      onClick={onClick}
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
      
      {/* Status indicator */}
      <div className="absolute top-4 right-4">
        <div className={`
          relative w-3 h-3 rounded-full transition-all duration-300
          ${device.online ? 'bg-green-500' : 'bg-gray-400'}
        `}>
          {device.online && (
            <>
              <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-75" />
              <div className="absolute inset-0 bg-green-500 rounded-full animate-pulse" />
            </>
          )}
        </div>
      </div>

      <div className="relative z-10 p-6">
        {/* Device hostname */}
        <h3 className="text-lg font-bold text-gray-900 mb-2 truncate group-hover:text-blue-700 transition-colors duration-300">
          {device.hostname}
        </h3>
        
        {/* User */}
        <p className="text-sm text-gray-600 mb-3 truncate">
          <span className="font-medium">User:</span> {device.user}
        </p>
        
        {/* Status badge */}
        <div className="flex items-center justify-between">
          <span className={`
            inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold
            transition-all duration-300 group-hover:scale-105
            ${device.online 
              ? 'bg-green-500/20 text-green-700 border border-green-300' 
              : 'bg-gray-400/20 text-gray-600 border border-gray-300'
            }
          `}>
            <div className={`w-1.5 h-1.5 rounded-full ${device.online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            {device.online ? 'Online' : 'Offline'}
          </span>
          
          {/* Last seen */}
          <span className="text-xs text-gray-500 group-hover:text-gray-700 transition-colors duration-300">
            {device.last_seen}
          </span>
        </div>
      </div>
      
      {/* Hover effect border */}
      <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-blue-200/50 transition-colors duration-300" />
    </div>
  );
});

EnhancedDeviceCard.displayName = 'EnhancedDeviceCard';

export default EnhancedDeviceCard;
