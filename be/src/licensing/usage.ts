import * as vscode from 'vscode';
import { getTodayString } from '../gamification/quests';

const USAGE_STATE_KEY = 'be.dailyUsage';
export const FREE_DAILY_SUGGESTION_LIMIT = 5;

interface UsageState {
	date: string;
	suggestionsShown: number;
}

const DEFAULT_USAGE: UsageState = { date: '', suggestionsShown: 0 };

export function createUsageStore(context: vscode.ExtensionContext) {
	function readUsage(): UsageState {
		const stored = context.globalState.get<UsageState>(USAGE_STATE_KEY, DEFAULT_USAGE);
		const today = getTodayString();
		return stored.date === today ? stored : { date: today, suggestionsShown: 0 };
	}

	return {
		getRemainingFree(): number {
			return Math.max(0, FREE_DAILY_SUGGESTION_LIMIT - readUsage().suggestionsShown);
		},
		getShownToday(): number {
			return readUsage().suggestionsShown;
		},
		async recordSuggestionsShown(count: number): Promise<void> {
			if (count <= 0) {
				return;
			}
			const usage = readUsage();
			await context.globalState.update(USAGE_STATE_KEY, {
				date: usage.date,
				suggestionsShown: usage.suggestionsShown + count,
			});
		},
	};
}

export type UsageStore = ReturnType<typeof createUsageStore>;
