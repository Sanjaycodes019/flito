import { useEffect, useState } from 'react';
import api from '../services/api';

// Platform counters shared by everything in the admin area: the sidebar
// badges, the overview tiles, and any screen that changes them (approving a
// verification lowers "pending"). One small store instead of each screen
// keeping its own copy, so a decision made on one page updates the badge
// everywhere.
let cache = null;
const listeners = new Set();

export const refreshAdminStats = async () => {
  try {
    const { data } = await api.get('/admin/stats');
    cache = data.stats;
    listeners.forEach((listener) => listener(cache));
  } catch {
    // Counters are decoration; a failed refresh keeps the last known values.
  }
};

// `passive` reads the shared value without fetching. The admin shell fetches
// once per page, so screens inside it don't need to.
const useAdminStats = ({ passive = false } = {}) => {
  const [stats, setStats] = useState(cache);

  useEffect(() => {
    listeners.add(setStats);
    if (!passive) refreshAdminStats();
    return () => listeners.delete(setStats);
  }, [passive]);

  return stats;
};

export default useAdminStats;
