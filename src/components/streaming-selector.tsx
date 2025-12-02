'use client';

import { useStreamingPreference, type StreamingService } from '@/lib/streaming';

interface StreamingSelectorProps {
  compact?: boolean;
}

export function StreamingSelector({ compact = false }: StreamingSelectorProps) {
  const { service, setService, allServices, isLoaded } = useStreamingPreference();

  if (!isLoaded) {
    return null;
  }

  if (compact) {
    return (
      <select
        value={service}
        onChange={(e) => setService(e.target.value as StreamingService)}
        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
        title="Preferred streaming service"
      >
        {allServices.map((s) => (
          <option key={s.id} value={s.id}>
            {s.icon} {s.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">Play on:</span>
      <div className="flex gap-1">
        {allServices.map((s) => (
          <button
            key={s.id}
            onClick={() => setService(s.id)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              service === s.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={s.name}
          >
            {s.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
