import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import * as vscode from 'vscode';
import { createLicenseStore } from '../licensing/license';
import { createUsageStore, FREE_DAILY_SUGGESTION_LIMIT } from '../licensing/usage';
import { createStateStore, StateStore } from '../state/store';
import { ChallengesViewProvider, QuestLogProvider } from '../ui/sidebarProvider';
import { getTheme } from '../ui/themes';
import { challengeDefinitions } from '../gamification/challenges';

function createMockContext(initialState?: Record<string, unknown>) {
	const storage = new Map<string, unknown>(Object.entries(initialState ?? {}));
	return {
		extensionUri: vscode.Uri.file(path.resolve(__dirname, '../..')),
		globalState: {
			get: <T>(key: string, fallback: T): T => (storage.has(key) ? (storage.get(key) as T) : fallback),
			update: async (key: string, value: unknown) => {
				storage.set(key, value);
			},
		},
	} as unknown as vscode.ExtensionContext;
}

suite('Extension Test Suite', () => {
	test('contributes the SecureQuest view and commands', () => {
		const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')) as {
			contributes: {
				commands: Array<{ command: string }>;
				viewsContainers: { activitybar: Array<{ id: string; icon: string }> };
				views: Record<string, Array<{ id: string; name: string; type: string }>>;
			};
		};
		assert.strictEqual(packageJson.contributes.viewsContainers.activitybar[0].id, 'secureQuest');
		assert.strictEqual(packageJson.contributes.views.secureQuest[0].id, 'be.questLog');
		assert.strictEqual(packageJson.contributes.views.secureQuest[0].type, 'webview');
		assert.deepStrictEqual(packageJson.contributes.views.secureQuest[1], {
			id: 'be.challenges',
			name: 'Challenges',
			type: 'webview',
		});
		assert.deepStrictEqual(
			packageJson.contributes.commands.map((command) => command.command),
			[
				'be.helloWorld',
				'be.scanFile',
				'be.resetXP',
				'be.enterLicenseKey',
				'be.pickTheme',
				'be.createCustomQuest',
				'be.startChallenge',
				'be.explainFinding',
				'be.applyQuickFix',
				'be.exportWorkspaceReport',
			]
		);
	});

	test('renders Challenges in its dedicated view and refreshes completion status', () => {
		let completedChallengeIds: string[] = [];
		const stateStore = {
			getState: () => ({ completedChallengeIds }),
		} as unknown as StateStore;
		const provider = new ChallengesViewProvider(createMockContext(), stateStore);
		const webview = {
			options: {},
			html: '',
			asWebviewUri: (uri: vscode.Uri) => uri,
		} as unknown as vscode.Webview;
		provider.resolveWebviewView({ webview } as vscode.WebviewView);
		assert.match(webview.html, /Parameterize the Query/);
		assert.match(webview.html, /class="challenge locked"/);
		assert.doesNotMatch(webview.html, /LEVEL 1|BADGES|DAILY QUESTS/);

		completedChallengeIds = [challengeDefinitions[0].id];
		provider.refresh();
		assert.match(webview.html, /class="challenge completed"/);
	});

	test('refreshes the Quest Log webview from the state store', () => {
		const stateStore: StateStore = {
			getState: () => ({
				xp: 0,
				level: 1,
				vulnerabilitiesFixed: 0,
				fixedByRule: {},
				badges: [],
				dailyQuestsDate: '',
				dailyQuests: [],
				dailyFixedByRule: {},
			}),
			recordFixes: async () => ({ newBadges: [], xpAwarded: 0, questsCompleted: 0 }),
			resetAll: async () => undefined,
			addCustomQuest: async () => undefined,
			completeChallenge: async () => ({ newBadges: [], xpAwarded: 0, questsCompleted: 0 }),
		};
		const provider = new QuestLogProvider(createMockContext(), stateStore);
		const webview = {
			options: {},
			html: '',
			asWebviewUri: (uri: vscode.Uri) => uri,
		} as unknown as vscode.Webview;
		provider.resolveWebviewView({ webview } as vscode.WebviewView);
		assert.match(webview.html, /LEVEL 1/);
		assert.match(webview.html, /0 \/ 300 XP/);
		assert.match(webview.html, /First Blood/);
		assert.match(webview.html, /class="badge locked"/);

		stateStore.getState = () => ({
			xp: 10,
			level: 1,
			vulnerabilitiesFixed: 1,
			fixedByRule: { 'hardcoded-secret': 1 },
			badges: ['first-fix'],
			dailyQuestsDate: '',
			dailyQuests: [],
			dailyFixedByRule: {},
		});
		provider.refresh();
		assert.match(webview.html, /10 \/ 300 XP/);
		assert.match(webview.html, /FIXED: 1/);
		assert.match(webview.html, /class="badge unlocked"/);
	});

	test('tracks license activation and shows the free-tier usage status in the sidebar', async () => {
		const context = createMockContext();
		const licenseStore = createLicenseStore(context);
		const usageStore = createUsageStore(context);
		const stateStore: StateStore = {
			getState: () => ({
				xp: 0,
				level: 1,
				vulnerabilitiesFixed: 0,
				fixedByRule: {},
				badges: [],
				dailyQuestsDate: '',
				dailyQuests: [],
				dailyFixedByRule: {},
			}),
			recordFixes: async () => ({ newBadges: [], xpAwarded: 0, questsCompleted: 0 }),
			resetAll: async () => undefined,
			addCustomQuest: async () => undefined,
			completeChallenge: async () => ({ newBadges: [], xpAwarded: 0, questsCompleted: 0 }),
		};
		const provider = new QuestLogProvider(context, stateStore, licenseStore, usageStore);
		const webview = {
			options: {},
			html: '',
			asWebviewUri: (uri: vscode.Uri) => uri,
		} as unknown as vscode.Webview;
		provider.resolveWebviewView({ webview } as vscode.WebviewView);

		assert.match(webview.html, /FREE — 0\//);
		assert.match(webview.html, new RegExp(`FREE — 0\/${FREE_DAILY_SUGGESTION_LIMIT} suggestions today`));
		assert.ok(await licenseStore.activate('SQ-TEST12345678'));
		assert.strictEqual(licenseStore.getTier(), 'paid');
		provider.refresh();
		assert.match(webview.html, /PRO — Unlimited suggestions/);
	});

	test('tracks fixes, level, and first-fix badges in a single state update', async () => {
		const context = createMockContext();
		const store = createStateStore(context);
		const dailyQuests = store.getState().dailyQuests;
		const result = await store.recordFixes([
			{ ruleId: 'hardcoded-secret', xp: 10 },
			{ ruleId: 'unsafe-regex', xp: 20 },
		]);

		assert.deepStrictEqual(result.newBadges, ['first-fix']);
		const expectedQuestBonus = dailyQuests
			.filter((quest) => quest.target <= ({ 'hardcoded-secret': 1, 'unsafe-regex': 1 }[quest.ruleId] ?? 0))
			.reduce((sum, quest) => sum + quest.bonusXP, 0);
		assert.strictEqual(result.xpAwarded, 30 + expectedQuestBonus);
		assert.strictEqual(store.getState().xp, 30 + expectedQuestBonus);
		assert.strictEqual(store.getState().level, 1);
		assert.strictEqual(store.getState().vulnerabilitiesFixed, 2);
		assert.deepStrictEqual(store.getState().fixedByRule, {
			'hardcoded-secret': 1,
			'unsafe-regex': 1,
		});
		assert.deepStrictEqual(store.getState().badges, ['first-fix']);
	});

	test('tracks daily quest progress and awards its bonus at the target', async () => {
		const context = createMockContext();
		const store = createStateStore(context);
		const initialState = store.getState();
		const quest = initialState.dailyQuests[0];
		assert.ok(quest);

		const fixes = Array.from({ length: quest.target }, () => ({ ruleId: quest.ruleId, xp: 10 }));
		const result = await store.recordFixes(fixes);
		const state = store.getState();
		const updatedQuest = state.dailyQuests.find((candidate) => candidate.id === quest.id);

		assert.strictEqual(state.fixedByRule[quest.ruleId], quest.target);
		assert.strictEqual(state.dailyFixedByRule[quest.ruleId], quest.target);
		assert.strictEqual(updatedQuest?.progress, quest.target);
		assert.strictEqual(updatedQuest?.completed, true);
		assert.strictEqual(result.questsCompleted, 1);
		assert.strictEqual(result.xpAwarded, quest.target * 10 + quest.bonusXP);
	});

	test('limits repeated finding rewards to one payout per day', async () => {
		const store = createStateStore(createMockContext());
		const finding = { ruleId: 'insecure-crypto', xp: 10, key: 'insecure-crypto:0:example' };
		const first = await store.recordFixes([finding]);
		const second = await store.recordFixes([finding]);

		assert.strictEqual(first.xpAwarded >= 10, true);
		assert.strictEqual(second.xpAwarded, 0);
		assert.strictEqual(store.getState().vulnerabilitiesFixed, 1);
	});

	test('adds capped custom quest progress to the active daily list', async () => {
		const store = createStateStore(createMockContext());
		const quest = { id: 'custom-test', ruleId: 'hardcoded-secret', target: 4, label: 'Clear four secrets', bonusXP: 5 };
		await store.addCustomQuest(quest);

		const state = store.getState();
		assert.strictEqual(state.dailyQuests.length, 3);
		assert.deepStrictEqual(state.dailyQuests.find((entry) => entry.id === quest.id), {
			...quest,
			progress: 0,
			completed: false,
		});
	});

	test('awards challenge completion once and unlocks the injection category badge', async () => {
		const store = createStateStore(createMockContext());
		const injectionChallenges = challengeDefinitions.filter((challenge) => challenge.category === 'A03:2021 Injection');
		for (const challenge of injectionChallenges) {
			await store.completeChallenge(challenge.id, challenge.xpReward);
		}
		const repeated = await store.completeChallenge(injectionChallenges[0].id, injectionChallenges[0].xpReward);

		assert.strictEqual(repeated.xpAwarded, 0);
		assert.strictEqual(store.getState().badges.includes('injection-slayer'), true);
		assert.strictEqual(store.getState().completedChallengeIds?.length, injectionChallenges.length);
	});

	test('falls back to the default theme when a paid theme is no longer licensed', () => {
		assert.strictEqual(getTheme('synthwave', false).id, 'default');
		assert.strictEqual(getTheme('synthwave', true).id, 'synthwave');
	});

	test('rolls daily quests without changing lifetime progress', () => {
		const context = createMockContext({
			'be.playerState': {
				xp: 100,
				level: 1,
				vulnerabilitiesFixed: 7,
				fixedByRule: { 'hardcoded-secret': 5 },
				badges: ['secret-hunter'],
				dailyQuestsDate: '2000-01-01',
				dailyQuests: [],
				dailyFixedByRule: { 'hardcoded-secret': 2 },
			},
		});
		const state = createStateStore(context).getState();

		assert.notStrictEqual(state.dailyQuestsDate, '2000-01-01');
		assert.strictEqual(state.dailyQuests.length, 3);
		assert.deepStrictEqual(state.dailyFixedByRule, {});
		assert.strictEqual(state.vulnerabilitiesFixed, 7);
		assert.deepStrictEqual(state.fixedByRule, { 'hardcoded-secret': 5 });
		assert.deepStrictEqual(state.badges, ['secret-hunter']);
	});
});
