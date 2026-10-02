import * as vscode from 'vscode';
import { getNewlyUnlockedBadges } from '../gamification/badges';
import { QuestProgress, QuestTemplate, getTodayString, pickDailyQuests } from '../gamification/quests';

const STATE_KEY = 'be.playerState';
const CUSTOM_QUESTS_KEY = 'be.customQuests';
export const XP_PER_LEVEL = 300;

export interface PlayerState {
	xp: number;
	level: number;
	vulnerabilitiesFixed: number;
	fixedByRule: Record<string, number>;
	badges: string[];
	dailyQuestsDate: string;
	dailyQuests: QuestProgress[];
	dailyFixedByRule: Record<string, number>;
	dailyRewardedFindingKeys?: string[];
	completedChallengeIds?: string[];
}

const DEFAULT_STATE: PlayerState = {
	xp: 0,
	level: 1,
	vulnerabilitiesFixed: 0,
	fixedByRule: {},
	badges: [],
	dailyQuestsDate: '',
	dailyQuests: [],
	dailyFixedByRule: {},
	dailyRewardedFindingKeys: [],
	completedChallengeIds: [],
};

export interface FixEvent {
	ruleId: string;
	xp: number;
	key?: string;
}

export interface RecordFixesResult {
	newBadges: string[];
	xpAwarded: number;
	questsCompleted: number;
}

function rollOverQuestsIfNeeded(state: PlayerState, customQuests: QuestTemplate[] = []): PlayerState {
	const today = getTodayString();
	if (state.dailyQuestsDate === today) {
		return state;
	}
	return {
		...state,
		dailyQuestsDate: today,
		dailyQuests: pickDailyQuests(customQuests),
		dailyFixedByRule: {},
		dailyRewardedFindingKeys: [],
	};
}

export interface StateStore {
	getState(): PlayerState;
	recordFixes(fixes: FixEvent[]): Thenable<RecordFixesResult>;
	resetAll(): Thenable<void>;
	addCustomQuest(quest: QuestTemplate): Thenable<void>;
	completeChallenge(challengeId: string, xp: number): Thenable<RecordFixesResult>;
}

export function createStateStore(context: vscode.ExtensionContext): StateStore {
	function readState(): PlayerState {
		return context.globalState.get<PlayerState>(STATE_KEY, DEFAULT_STATE);
	}

	function writeState(state: PlayerState): Thenable<void> {
		return context.globalState.update(STATE_KEY, state);
	}

	function readCustomQuests(): QuestTemplate[] {
		return context.globalState.get<QuestTemplate[]>(CUSTOM_QUESTS_KEY, []);
	}

	function withDefaults(state: PlayerState): PlayerState {
		return { ...DEFAULT_STATE, ...state };
	}

	return {
		getState() {
			const stored = withDefaults(readState());
			const rolled = rollOverQuestsIfNeeded(stored, readCustomQuests());
			if (rolled !== stored) {
				void writeState(rolled);
			}
			return rolled;
		},

		recordFixes(fixes) {
			const state = rollOverQuestsIfNeeded(withDefaults(readState()), readCustomQuests());
			const rewardedKeys = state.dailyRewardedFindingKeys ?? [];
			const eligibleFixes = fixes.filter((fix) => !fix.key || !rewardedKeys.includes(fix.key));
			let xpAwarded = eligibleFixes.reduce((sum, fix) => sum + fix.xp, 0);
			const nextState: PlayerState = {
				...state,
				vulnerabilitiesFixed: state.vulnerabilitiesFixed + eligibleFixes.length,
				fixedByRule: { ...state.fixedByRule },
				badges: [...state.badges],
				dailyFixedByRule: { ...state.dailyFixedByRule },
				dailyRewardedFindingKeys: [...rewardedKeys],
				completedChallengeIds: [...(state.completedChallengeIds ?? [])],
				dailyQuests: state.dailyQuests.map((quest) => ({ ...quest })),
			};

			for (const fix of eligibleFixes) {
				if (fix.key) {
					nextState.dailyRewardedFindingKeys?.push(fix.key);
				}
				nextState.fixedByRule[fix.ruleId] = (nextState.fixedByRule[fix.ruleId] ?? 0) + 1;
				nextState.dailyFixedByRule[fix.ruleId] = (nextState.dailyFixedByRule[fix.ruleId] ?? 0) + 1;
			}

			let questsCompleted = 0;
			for (const quest of nextState.dailyQuests) {
				if (quest.completed) {
					continue;
				}
				quest.progress = nextState.dailyFixedByRule[quest.ruleId] ?? 0;
				if (quest.progress >= quest.target) {
					quest.completed = true;
					xpAwarded += quest.bonusXP;
					questsCompleted += 1;
				}
			}

			nextState.xp = state.xp + xpAwarded;
			nextState.level = Math.floor(nextState.xp / XP_PER_LEVEL) + 1;
			const newlyUnlocked = getNewlyUnlockedBadges(nextState);
			nextState.badges = [...nextState.badges, ...newlyUnlocked.map((badge) => badge.id)];

			return writeState(nextState).then(() => ({
				newBadges: newlyUnlocked.map((badge) => badge.id),
				xpAwarded,
				questsCompleted,
			}));
		},

		resetAll() {
			return writeState(DEFAULT_STATE);
		},

		async addCustomQuest(quest) {
			const quests = readCustomQuests();
			const nextQuests = [...quests.filter((entry) => entry.id !== quest.id), quest];
			await context.globalState.update(CUSTOM_QUESTS_KEY, nextQuests);
			const state = rollOverQuestsIfNeeded(withDefaults(readState()), nextQuests);
			const activeQuest: QuestProgress = {
				...quest,
				progress: state.dailyFixedByRule[quest.ruleId] ?? 0,
				completed: (state.dailyFixedByRule[quest.ruleId] ?? 0) >= quest.target,
			};
			const otherQuests = state.dailyQuests.filter((entry) => entry.ruleId !== quest.ruleId).slice(0, 2);
			await writeState({ ...state, dailyQuests: [...otherQuests, activeQuest] });
		},

		completeChallenge(challengeId, xp) {
			const state = withDefaults(readState());
			const completedIds = state.completedChallengeIds ?? [];
			if (completedIds.includes(challengeId)) {
				return Promise.resolve({ newBadges: [], xpAwarded: 0, questsCompleted: 0 });
			}
			const nextState: PlayerState = {
				...state,
				completedChallengeIds: [...completedIds, challengeId],
				xp: state.xp + xp,
				badges: [...state.badges],
			};
			nextState.level = Math.floor(nextState.xp / XP_PER_LEVEL) + 1;
			const newlyUnlocked = getNewlyUnlockedBadges(nextState);
			nextState.badges.push(...newlyUnlocked.map((badge) => badge.id));
			return writeState(nextState).then(() => ({
				newBadges: newlyUnlocked.map((badge) => badge.id),
				xpAwarded: xp,
				questsCompleted: 0,
			}));
		},
	};
}
