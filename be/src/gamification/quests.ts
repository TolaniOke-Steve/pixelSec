export interface QuestTemplate {
	id: string;
	ruleId: string;
	target: number;
	label: string;
	bonusXP: number;
}

export const questPool: QuestTemplate[] = [
    { id: 'quest-secrets-1', ruleId: 'hardcoded-secret', target: 1, label: 'Remove 1 hardcoded secret', bonusXP: 15 },
    { id: 'quest-secrets-5', ruleId: 'hardcoded-secret', target: 5, label: 'Clear 5 hardcoded secrets', bonusXP: 35 },
    { id: 'quest-regex-1', ruleId: 'unsafe-regex', target: 1, label: 'Fix 1 unsafe regex pattern', bonusXP: 10 },
    { id: 'quest-regex-3', ruleId: 'unsafe-regex', target: 3, label: 'Fix 3 unsafe regex patterns', bonusXP: 20 },
    { id: 'quest-regex-5', ruleId: 'unsafe-regex', target: 5, label: 'Harden 5 unsafe regex patterns', bonusXP: 35 },
    { id: 'quest-crypto-1', ruleId: 'insecure-crypto', target: 1, label: 'Refactor 1 insecure crypto call', bonusXP: 10 },
    { id: 'quest-crypto-3', ruleId: 'insecure-crypto', target: 3, label: 'Refactor 3 insecure crypto calls', bonusXP: 30 },
    { id: 'quest-eval-1', ruleId: 'dangerous-eval', target: 1, label: 'Eliminate 1 dangerous eval call', bonusXP: 15 },
    { id: 'quest-eval-3', ruleId: 'dangerous-eval', target: 3, label: 'Eliminate 3 dangerous eval calls', bonusXP: 35 },
];

export interface QuestProgress extends QuestTemplate {
	progress: number;
	completed: boolean;
}

const QUESTS_PER_DAY = 3;

export function pickDailyQuests(customQuests: QuestTemplate[] = []): QuestProgress[] {
	const shuffled = [...questPool, ...customQuests].sort(() => Math.random() - 0.5);
	const selected: QuestTemplate[] = [];
	const seenRuleIds = new Set<string>();

	for (const template of shuffled) {
		if (seenRuleIds.has(template.ruleId)) {
			continue;
		}
		selected.push(template);
		seenRuleIds.add(template.ruleId);
		if (selected.length === QUESTS_PER_DAY) {
			break;
		}
	}

	return selected.map((template) => ({
		...template,
		progress: 0,
		completed: false,
	}));
}

export function getTodayString(): string {
	return new Date().toISOString().slice(0, 10);
}