export interface Team {
  id: string;
  name: string;
  logoUrl?: string | null;
  day?: string | null;
  isBye?: boolean;
}

export interface Match {
  id: string;
  roundName: string;
  bracket: 'UB' | 'LB' | 'GF' | 'THIRD';
  bo: number;
  scheduledDate?: string | null;
  team1: Team | null;
  team2: Team | null;
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
  loserId: string | null;
  state: 'upcoming' | 'ongoing' | 'finished' | 'tbd' | 'bye';
  streamUrl?: string | null;
  nextWinMatchId: string | null;
  nextLoseMatchId: string | null;
}

export interface TournamentRound {
  id: string;
  name: string;
  bracket: 'UB' | 'LB' | 'GF' | 'THIRD';
  matchIds: string[];
}

export interface TournamentStageData {
  generated: boolean;
  matches: Record<string, Match>;
  rounds: TournamentRound[];
}

export interface TournamentConfig {
  name: string;
  stage1MaxTeams: number;
  stage1Advance: number;
  adminRoleIds: string[];
}

export interface TournamentData {
  config: TournamentConfig;
  teams: Record<string, Team>;
  stage1: TournamentStageData;
  stage2: TournamentStageData;
}
