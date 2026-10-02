import * as vscode from 'vscode';
import { debounceByDocument } from './engine/debounce';
import { analyzeDocument } from './engine/analyzer';
import { badgeDefinitions } from './gamification/badges';
import { challengeDefinitions, Challenge } from './gamification/challenges';
import { rules } from './rules';
import { createLicenseStore } from './licensing/license';
import { requirePaid } from './licensing/gate';
import { createUsageStore, FREE_DAILY_SUGGESTION_LIMIT } from './licensing/usage';
import { QuestTemplate } from './gamification/quests';
import { createStateStore } from './state/store';
import { ChallengesViewProvider, QuestLogProvider, THEME_STATE_KEY } from './ui/sidebarProvider';
import { getTheme, themes } from './ui/themes';
import { showBadgePopup, showXPPopup } from './ui/webviewPanel';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "be" is now active!');

	const stateStore = createStateStore(context);
	const licenseStore = createLicenseStore(context);
	const usageStore = createUsageStore(context);
	const questLogProvider = new QuestLogProvider(context, stateStore, licenseStore, usageStore);
	const challengesViewProvider = new ChallengesViewProvider(context, stateStore, licenseStore);
	const refreshQuestViews = () => {
		questLogProvider.refresh();
		challengesViewProvider.refresh();
	};
	const diagnostics = vscode.languages.createDiagnosticCollection('be');
	const customDiagnostics = vscode.languages.createDiagnosticCollection('be-team-rules');
	const previousFindings = new Map<string, Map<string, number>>();
	const seenFindingKeys = new Map<string, Set<string>>();
	const challengeDocuments = new Map<string, Challenge>();
	let quotaMessageShownAt = 0;

	function currentTheme() {
		return getTheme(context.globalState.get<string>(THEME_STATE_KEY, 'default'), licenseStore.isPaid());
	}

	function showQuotaReachedMessage() {
		const now = Date.now();
		if (now - quotaMessageShownAt < 60_000) {
			return;
		}
		quotaMessageShownAt = now;
		void vscode.window
			.showInformationMessage(
				`Free tier limit reached (${FREE_DAILY_SUGGESTION_LIMIT} suggestions/day). Upgrade for unlimited hints.`,
				'Enter License Key'
			)
			.then((choice) => {
				if (choice === 'Enter License Key') {
					void vscode.commands.executeCommand('be.enterLicenseKey');
				}
			});
	}

	function updateDiagnostics(document: vscode.TextDocument): Map<string, number> {
		const tier = licenseStore.getTier();
		const allFindings = analyzeDocument(document, tier);
		const documentKey = document.uri.toString();

		let visible = allFindings;
		if (tier === 'free') {
			const seen = seenFindingKeys.get(documentKey) ?? new Set<string>();
			const remaining = usageStore.getRemainingFree();
			const alreadySeen = allFindings.filter((finding) => seen.has(finding.key));
			const brandNew = allFindings.filter((finding) => !seen.has(finding.key));
			const newlySurfaced = brandNew.slice(0, remaining);

			newlySurfaced.forEach((finding) => seen.add(finding.key));
			seenFindingKeys.set(documentKey, seen);

			if (newlySurfaced.length > 0) {
				void usageStore.recordSuggestionsShown(newlySurfaced.length);
			}
			if (brandNew.length > newlySurfaced.length) {
				showQuotaReachedMessage();
			}

			visible = [...alreadySeen, ...newlySurfaced];
		}

		diagnostics.set(document.uri, visible.map((finding) => finding.diagnostic));
		const findingsMap = new Map<string, number>();
		visible.forEach((finding) => findingsMap.set(finding.key, finding.xp));
		return findingsMap;
	}

	async function runAnalysis(document: vscode.TextDocument): Promise<void> {
		const findings = updateDiagnostics(document);
		const customFindings = await scanCustomRules(document);
		customDiagnostics.set(document.uri, customFindings.map((finding) => finding.diagnostic));
		customFindings.forEach((finding) => findings.set(finding.key, finding.xp));
		const documentKey = document.uri.toString();
		const previous = previousFindings.get(documentKey);
		if (previous) {
			const resolvedFixes: { ruleId: string; xp: number; key: string }[] = [];
			for (const [key, xp] of previous) {
				if (!findings.has(key)) {
					resolvedFixes.push({ ruleId: key.split(':')[0], xp, key });
				}
			}
			if (resolvedFixes.length > 0) {
				void stateStore.recordFixes(resolvedFixes).then(({ newBadges, xpAwarded, questsCompleted }) => {
					refreshQuestViews();
					if (xpAwarded > 0) {
						showXPPopup(context, questsCompleted > 0 ? 'Quest complete!' : 'Issue fixed!', xpAwarded, currentTheme());
					}
					if (newBadges.length > 0) {
						const unlockedBadges = badgeDefinitions.filter((badge) => newBadges.includes(badge.id));
						setTimeout(() => showBadgePopup(context, unlockedBadges, currentTheme()), 700);
					}
				});
			}
		} else if (findings.size > 0) {
			void vscode.window.showInformationMessage('Security issue detected.');
		}

		previousFindings.set(documentKey, findings);
	}

	const saveListener = vscode.workspace.onDidSaveTextDocument((document) => { void runAnalysis(document); });
	const updateDiagnosticsAfterTyping = debounceByDocument(updateDiagnostics, 500);
	const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
		if (['javascript', 'javascriptreact', 'typescript', 'typescriptreact'].includes(event.document.languageId)) {
			updateDiagnosticsAfterTyping(event.document);
			gradeChallengeDocument(event.document);
		}
	});
	const questLogView = vscode.window.registerWebviewViewProvider('be.questLog', questLogProvider);
	const challengesView = vscode.window.registerWebviewViewProvider('be.challenges', challengesViewProvider);
	context.subscriptions.push(diagnostics, customDiagnostics, saveListener, changeListener, questLogView, challengesView);

	async function gradeChallengeDocument(document: vscode.TextDocument): Promise<void> {
		const documentKey = document.uri.toString();
		const challenge = challengeDocuments.get(documentKey);
		if (!challenge || analyzeDocument(document, 'paid').some((finding) => finding.key.startsWith(`${challenge.ruleId}:`))) {
			return;
		}
		challengeDocuments.delete(documentKey);
		const result = await stateStore.completeChallenge(challenge.id, challenge.xpReward);
		refreshQuestViews();
		showXPPopup(context, 'Challenge complete!', result.xpAwarded, currentTheme());
		if (result.newBadges.length > 0) {
			const unlockedBadges = badgeDefinitions.filter((badge) => result.newBadges.includes(badge.id));
			showBadgePopup(context, unlockedBadges, currentTheme());
		}
	}

	async function scanCustomRules(document: vscode.TextDocument): Promise<Array<{ key: string; xp: number; diagnostic: vscode.Diagnostic }>> {
		if (!licenseStore.isPaid()) {
			return [];
		}
		const folder = vscode.workspace.getWorkspaceFolder(document.uri);
		if (!folder) {
			return [];
		}
		try {
			const configUri = vscode.Uri.joinPath(folder.uri, '.securequest.json');
			const config = JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(configUri))) as {
				rules?: Array<{ id?: string; pattern?: string; flags?: string; message?: string; severity?: string; xp?: number }>;
			};
			const results: Array<{ key: string; xp: number; diagnostic: vscode.Diagnostic }> = [];
			for (const customRule of (config.rules ?? []).slice(0, 10)) {
				const pattern = customRule.pattern ?? '';
				const unsafePattern = /\\[1-9]|\\k<|\(\?[=!<]|\([^)]*[+*][^)]*\)[+*{]|\([^)]*\|[^)]*\)[+*{]/;
				if (!/^[a-z0-9-]{1,40}$/i.test(customRule.id ?? '') || pattern.length === 0 || pattern.length > 160 || unsafePattern.test(pattern)) {
					continue;
				}
				try {
					const flags = [...new Set((customRule.flags ?? '').replace(/[^im]/g, '') + 'g')].join('');
					const matcher = new RegExp(pattern, flags);
					const text = document.getText();
					for (const match of text.matchAll(matcher)) {
						if (results.length >= 100) {
							break;
						}
						if (match[0].length === 0) {
							continue;
						}
						const start = match.index ?? 0;
						const diagnostic = new vscode.Diagnostic(
							new vscode.Range(document.positionAt(start), document.positionAt(start + match[0].length)),
							customRule.message ?? `Team rule ${customRule.id} matched.`,
							customRule.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning
						);
						diagnostic.source = 'be-team';
						results.push({
							key: `team-${customRule.id}:${start}`,
							xp: Math.max(0, Math.min(20, Math.floor(customRule.xp ?? 5))),
							diagnostic,
						});
					}
				} catch {
					continue;
				}
			}
			return results;
		} catch {
			return [];
		}
	}

	const codeActionProvider: vscode.CodeActionProvider = {
		provideCodeActions(document, _range, codeActionContext) {
			return codeActionContext.diagnostics.flatMap((diagnostic) => {
				const ruleId = typeof diagnostic.code === 'string'
					? diagnostic.code
					: typeof diagnostic.code === 'object'
						? String(diagnostic.code.value)
						: undefined;
				if (!ruleId) {
					return [];
				}
				const actions: vscode.CodeAction[] = [];
				const explanation = new vscode.CodeAction('Explain this finding', vscode.CodeActionKind.QuickFix);
				explanation.diagnostics = [diagnostic];
				explanation.command = { title: 'Explain this finding', command: 'be.explainFinding', arguments: [ruleId] };
				actions.push(explanation);
				if (getQuickFix(document.getText(diagnostic.range), ruleId)) {
					const quickFix = new vscode.CodeAction('Apply SecureQuest quick fix', vscode.CodeActionKind.QuickFix);
					quickFix.diagnostics = [diagnostic];
					quickFix.command = {
						title: 'Apply SecureQuest quick fix',
						command: 'be.applyQuickFix',
						arguments: [document.uri, diagnostic.range, ruleId],
					};
					actions.push(quickFix);
				}
				return actions;
			});
		},
	};
	context.subscriptions.push(vscode.languages.registerCodeActionsProvider(
		[{ language: 'javascript' }, { language: 'javascriptreact' }, { language: 'typescript' }, { language: 'typescriptreact' }],
		codeActionProvider,
		{ providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
	));

	const helloWorldCommand = vscode.commands.registerCommand('be.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from bookish-eureka!');
	});

	const scanFileCommand = vscode.commands.registerCommand('be.scanFile', () => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			void vscode.window.showWarningMessage('No active file to scan.');
			return;
		}
		runAnalysis(editor.document);
	});

	const enterLicenseCommand = vscode.commands.registerCommand('be.enterLicenseKey', async () => {
		const key = await vscode.window.showInputBox({
			prompt: 'Enter your SecureQuest Pro license key',
			placeHolder: 'SQ-XXXXXXXXXXXX',
		});
		if (!key) {
			return;
		}
		const ok = await licenseStore.activate(key);
		if (ok) {
			void vscode.window.showInformationMessage('SecureQuest Pro activated. Unlimited suggestions unlocked.');
		} else {
			void vscode.window.showWarningMessage("That license key doesn't look valid.");
		}
		refreshQuestViews();
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			updateDiagnostics(editor.document);
		}
	});

	const resetXPCommand = vscode.commands.registerCommand('be.resetXP', async () => {
		await stateStore.resetAll();
		refreshQuestViews();
		void vscode.window.showInformationMessage('Progress reset.');
	});

	const pickThemeCommand = vscode.commands.registerCommand('be.pickTheme', async () => {
		if (!await requirePaid('Theme packs', licenseStore)) {
			return;
		}
		const choice = await vscode.window.showQuickPick(themes.map((theme) => ({ label: theme.name, description: theme.id })), {
			placeHolder: 'Choose a SecureQuest theme',
		});
		if (!choice) {
			return;
		}
		await context.globalState.update(THEME_STATE_KEY, choice.description);
		refreshQuestViews();
	});

	const createCustomQuestCommand = vscode.commands.registerCommand('be.createCustomQuest', async () => {
		if (!await requirePaid('Custom quests', licenseStore)) {
			return;
		}
		const ruleChoice = await vscode.window.showQuickPick(rules.map((rule) => ({
			label: rule.id,
			description: rule.tier === 'paid' ? 'Pro rule' : 'Core rule',
		})), { placeHolder: 'Choose a rule to track' });
		if (!ruleChoice) {
			return;
		}
		const targetValue = await vscode.window.showInputBox({
			prompt: 'How many findings should this quest target? (1-10)',
			validateInput: (value) => /^([1-9]|10)$/.test(value) ? undefined : 'Enter a whole number from 1 to 10.',
		});
		if (!targetValue) {
			return;
		}
		const label = await vscode.window.showInputBox({
			prompt: 'Quest label',
			validateInput: (value) => value.trim().length >= 3 && value.trim().length <= 80 ? undefined : 'Use 3 to 80 characters.',
		});
		if (!label) {
			return;
		}
		const quest: QuestTemplate = {
			id: `custom-${Date.now()}`,
			ruleId: ruleChoice.label,
			target: Number(targetValue),
			label: label.trim(),
			bonusXP: 5,
		};
		await stateStore.addCustomQuest(quest);
		refreshQuestViews();
	});

	const startChallengeCommand = vscode.commands.registerCommand('be.startChallenge', async () => {
		if (!await requirePaid('Security challenges', licenseStore)) {
			return;
		}
		const completed = new Set(stateStore.getState().completedChallengeIds ?? []);
		const available = challengeDefinitions.filter((challenge) => !completed.has(challenge.id));
		if (available.length === 0) {
			void vscode.window.showInformationMessage('All SecureQuest challenges are complete.');
			return;
		}
		const choice = await vscode.window.showQuickPick(available.map((challenge) => ({
			label: challenge.title,
			description: challenge.category,
			challenge,
		})), { placeHolder: 'Choose a security challenge' });
		if (!choice) {
			return;
		}
		const document = await vscode.workspace.openTextDocument({ language: 'javascript', content: choice.challenge.vulnerableSnippet });
		challengeDocuments.set(document.uri.toString(), choice.challenge);
		await vscode.window.showTextDocument(document, { preview: false });
		void vscode.window.showInformationMessage(`Hint: ${choice.challenge.hint}`);
	});

	const explainFindingCommand = vscode.commands.registerCommand('be.explainFinding', async (ruleId: string) => {
		if (!await requirePaid('Detailed finding explanations', licenseStore)) {
			return;
		}
		const rule = rules.find((entry) => entry.id === ruleId);
		if (rule) {
			const category = rule.owaspCategory ?? 'Security';
			const choice = await vscode.window.showInformationMessage(
				`${category}: ${rule.explanation ?? 'Review the finding and apply secure coding defaults.'}`,
				...(rule.owaspCategory ? ['Open OWASP reference'] : [])
			);
			const owaspUrl = getOwaspUrl(rule.owaspCategory);
			if (choice === 'Open OWASP reference' && owaspUrl) {
				await vscode.env.openExternal(vscode.Uri.parse(owaspUrl));
			}
		}
	});

	const applyQuickFixCommand = vscode.commands.registerCommand('be.applyQuickFix', async (
		uri: vscode.Uri,
		range: vscode.Range,
		ruleId: string
	) => {
		if (!await requirePaid('One-click quick fixes', licenseStore)) {
			return;
		}
		const editor = await vscode.window.showTextDocument(uri);
		const current = editor.document.getText(range);
		const replacement = getQuickFix(current, ruleId);
		if (!replacement) {
			return;
		}
		await editor.edit((editBuilder) => editBuilder.replace(range, replacement));
	});

	const workspaceReportCommand = vscode.commands.registerCommand('be.exportWorkspaceReport', async () => {
		if (!await requirePaid('Workspace security reports', licenseStore)) {
			return;
		}
		const files = await vscode.workspace.findFiles('**/*.{js,jsx,ts,tsx}', '**/{node_modules,out,dist}/**');
		const findingsByRule = new Map<string, number>();
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Scanning workspace security findings',
			cancellable: false,
		}, async (progress) => {
			for (let index = 0; index < files.length; index += 1) {
				const document = await vscode.workspace.openTextDocument(files[index]);
				for (const finding of analyzeDocument(document, 'paid')) {
					const ruleId = finding.key.split(':')[0];
					findingsByRule.set(ruleId, (findingsByRule.get(ruleId) ?? 0) + 1);
				}
				if (index % 20 === 0) {
					progress.report({ message: `${index + 1} of ${files.length} files` });
					await new Promise<void>((resolve) => setTimeout(resolve, 0));
				}
			}
		});
		const categories = new Map<string, number>();
		const rows = [...findingsByRule].sort(([left], [right]) => left.localeCompare(right)).map(([ruleId, count]) => {
			const category = rules.find((rule) => rule.id === ruleId)?.owaspCategory ?? 'Other';
			categories.set(category, (categories.get(category) ?? 0) + count);
			return `| ${ruleId} | ${category} | ${count} |`;
		});
		const report = [
			'# SecureQuest Workspace Report',
			'',
			`Scanned ${files.length} JavaScript and TypeScript files.`,
			'',
			'## Findings by Rule',
			'| Rule | OWASP category | Findings |',
			'| --- | --- | ---: |',
			...(rows.length ? rows : ['| None | - | 0 |']),
			'',
			'## Findings by OWASP Category',
			...([...categories].sort(([left], [right]) => left.localeCompare(right)).map(([category, count]) => `- ${category}: ${count}`)),
		].join('\n');
		const destination = await vscode.window.showSaveDialog({ filters: { Markdown: ['md'] }, saveLabel: 'Export report' });
		if (destination) {
			await vscode.workspace.fs.writeFile(destination, new TextEncoder().encode(report));
			void vscode.window.showInformationMessage(`Security report exported (${files.length} files scanned).`);
		}
	});

	context.subscriptions.push(
		helloWorldCommand,
		scanFileCommand,
		enterLicenseCommand,
		resetXPCommand,
		pickThemeCommand,
		createCustomQuestCommand,
		startChallengeCommand,
		explainFindingCommand,
		applyQuickFixCommand,
		workspaceReportCommand
	);
}

export function deactivate() {}

function getQuickFix(text: string, ruleId: string): string | undefined {
	switch (ruleId) {
		case 'insecure-crypto':
			return text.replace(/\b(?:md5|sha1)\b/i, 'sha256');
		case 'disabled-tls-verification':
			return text.replace(/\bfalse\b/, 'true');
		case 'xss-sink':
			return text.replace(/\.innerHTML\b/, '.textContent');
		case 'hardcoded-secret':
			return text.replace(/(['"`])[^'"`\r\n]*\1/, 'process.env.API_KEY');
		default:
			return undefined;
	}
}

function getOwaspUrl(category: string | undefined): string | undefined {
	const match = category?.match(/^([A-Z]\d{2}):2021\s+(.+)$/);
	if (!match) {
		return undefined;
	}
	const slug = `${match[1]}_2021-${match[2].replace(/\s+/g, '_')}`;
	return `https://owasp.org/Top10/${slug}/`;
}
