import { PlayerState } from '../state/store';
import { challengeDefinitions } from './challenges';

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string[];
  color: string;
  isUnlocked(state: PlayerState): boolean;
}

const DROPLET_ICON = [
  '00011000',
  '00011000',
  '00111100',
  '01111110',
  '11111111',
  '11111111',
  '01111110',
  '00111100',
];

const CHECKBOX_ICON = [
  '11111110',
  '10000010',
  '10000010',
  '10001010',
  '10010010',
  '10100010',
  '10000010',
  '11111110',
];

const LIGHTNING_ICON = [
  '00011000',
  '00110000',
  '01100000',
  '11111100',
  '00011000',
  '00110000',
  '01100000',
  '11000000',
];

const BROOM_ICON = [
  '00000110',
  '00001100',
  '00011000',
  '00110000',
  '01100000',
  '11111110',
  '11111110',
  '01010100',
];

const SHIELD_ICON = [
  '01111110',
  '11111111',
  '11111111',
  '11011011',
  '11111111',
  '01111110',
  '00111100',
  '00011000',
];

const MAGNIFIER_ICON = [
  '00111000',
  '01000100',
  '10000010',
  '10000010',
  '01000100',
  '00111000',
  '00000110',
  '00000011',
];

const STAR_ICON = [
  '00011000',
  '00111100',
  '01111110',
  '11111111',
  '01111110',
  '00111100',
  '01100110',
  '11000011',
];

const INJECTION_ICON = [
  '00011000',
  '00011000',
  '11111111',
  '00111100',
  '00111100',
  '00111100',
  '00011000',
  '00011000',
];

const KEY_ICON = [
  '00111000',
  '00101000',
  '00111000',
  '00001000',
  '00001000',
  '00001000',
  '00011000',
  '00011000',
];
export const badgeDefinitions: BadgeDefinition[] = [
  {
    id: 'first-fix',
    name: 'First Blood',
    description: 'Fixed your first vulnerability.',
    icon: DROPLET_ICON,
    color: '#DC143C',
    isUnlocked: (state) => state.vulnerabilitiesFixed >= 1,
  },
  {
    id: 'issue-5',
    name: 'Issue Tracker',
    description: 'Fixed 5 vulnerabilities.',
    icon: CHECKBOX_ICON,
    color: '#CD7F32',
    isUnlocked: (state) => state.vulnerabilitiesFixed >= 5,
  },
  {
    id: 'issue-10',
    name: 'Momentum',
    description: 'Fixed 10 vulnerabilities.',
    icon: LIGHTNING_ICON,
    color: '#8FAADC',
    isUnlocked: (state) => state.vulnerabilitiesFixed >= 10,
  },
  {
    id: 'issue-50',
    name: 'Cleanup Crew',
    description: 'Fixed 50 vulnerabilities.',
    icon: BROOM_ICON,
    color: '#FFD700',
    isUnlocked: (state) => state.vulnerabilitiesFixed >= 50,
  },
  {
    id: 'issue-100',
    name: 'Elite Defender',
    description: 'Fixed 100 vulnerabilities.',
    icon: SHIELD_ICON,
    color: '#B9F2FF',
    isUnlocked: (state) => state.vulnerabilitiesFixed >= 100,
  },
  {
    id: 'secret-hunter',
    name: 'Secret Hunter',
    description: 'Fixed 5 hardcoded secrets.',
    icon: MAGNIFIER_ICON,
    color: '#9B59B6',
    isUnlocked: (state) => (state.fixedByRule['hardcoded-secret'] ?? 0) >= 5,
  },
  {
    id: 'level-5',
    name: 'Rising Star',
    description: 'Reached Level 5.',
    icon: STAR_ICON,
    color: '#FFD700',
    isUnlocked: (state) => state.level >= 5,
  },
  {
    id: 'injection-slayer',
    name: 'Injection Slayer',
    description: 'Complete every injection challenge.',
    icon: INJECTION_ICON,
    color: '#FF5EA8',
    isUnlocked: (state) => {
      const injectionChallenges = challengeDefinitions.filter((challenge) => challenge.category === 'A03:2021 Injection');
      const completed = new Set(state.completedChallengeIds ?? []);
      return injectionChallenges.every((challenge) => completed.has(challenge.id));
    },
  },
  {
    id: 'crypto-guardian',
    name: 'Crypto Guardian',
    description: 'Complete every cryptographic failures challenge.',
    icon: KEY_ICON,
    color: '#75E6DA',
    isUnlocked: (state) => {
      const categoryChallenges = challengeDefinitions.filter((challenge) => challenge.category === 'A02:2021 Cryptographic Failures');
      const completed = new Set(state.completedChallengeIds ?? []);
      return categoryChallenges.every((challenge) => completed.has(challenge.id));
    },
  },
];

export function getNewlyUnlockedBadges(state: PlayerState): BadgeDefinition[] {
  return badgeDefinitions.filter(
    (badge) => !state.badges.includes(badge.id) && badge.isUnlocked(state)
  );
}
