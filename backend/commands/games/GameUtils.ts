import type { Command, CommandContext } from '../types';

interface GroupScore {
  [playerId: string]: {
    name: string;
    score: number;
  };
}

const minigameScores = new Map<string, GroupScore>();

export function setScore(groupId: string, playerId: string, playerName: string, points: number) {
  const group = minigameScores.get(groupId) || {};
  group[playerId] = { name: playerName, score: points };
  minigameScores.set(groupId, group);
}

export function addWin(groupId: string, playerId: string, playerName: string, points: number = 1) {
  const group = minigameScores.get(groupId) || {};
  if (!group[playerId]) {
    group[playerId] = { name: playerName, score: 0 };
  }
  group[playerId].score += points;
  minigameScores.set(groupId, group);
}

export function getLeaderboard(groupId: string): string {
  const group = minigameScores.get(groupId);
  if (!group || Object.keys(group).length === 0) return 'No scores yet!';
  
  const sorted = Object.entries(group)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.score - a.score);

  return sorted.map((p, i) => `${i + 1}. ${p.name}: ${p.score} pts`).join('\n');
}