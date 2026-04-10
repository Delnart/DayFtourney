import { useState, useEffect, useCallback } from 'react';
import { TournamentData } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const POLL_INTERVAL = 10000; // 10 seconds

// Fallback empty state
const emptyTournament: TournamentData = {
  config: { name: 'Day F 2026', stage1MaxTeams: 64, stage1Advance: 16, adminRoleIds: [] },
  teams: {},
  stage1: { generated: false, matches: {}, rounds: [] },
  stage2: { generated: false, matches: {}, rounds: [] },
};

export function useTournamentData() {
  const [data, setData] = useState<TournamentData>(emptyTournament);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/tournament`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json: TournamentData = await res.json();
      setData(json);
      setError(null);
      setLastUpdated(new Date());
    } catch (e: any) {
      // If API is unavailable, keep showing current data (or fallback)
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, loading, error, lastUpdated, refetch: fetchData };
}
