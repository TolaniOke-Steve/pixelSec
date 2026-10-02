import * as vscode from 'vscode';
import { badgeDefinitions } from '../gamification/badges';
import { LicenseStore } from '../licensing/license';
import { FREE_DAILY_SUGGESTION_LIMIT, UsageStore } from '../licensing/usage';
import { XP_PER_LEVEL, StateStore } from '../state/store';
import { challengeDefinitions } from '../gamification/challenges';
import { getTheme, themeCssVariables } from './themes';

export const THEME_STATE_KEY = 'be.theme';

export class QuestLogProvider implements vscode.WebviewViewProvider {
	private view: vscode.WebviewView | undefined;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly stateStore: StateStore,
		private readonly licenseStore?: LicenseStore,
		private readonly usageStore?: UsageStore
	) {}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.view = webviewView;
		webviewView.webview.options = {
			enableScripts: false,
			localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
		};
		this.render();
	}

	refresh(): void {
		this.render();
	}

	private render(): void {
		if (!this.view) {
			return;
		}
		const fontUri = this.view.webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'media', 'fonts', 'PressStart2P-Regular.ttf')
		);
		this.view.webview.html = this.getHtml(fontUri);
	}

	private getHtml(fontUri: vscode.Uri): string {
		const state = this.stateStore.getState();
		const xpIntoLevel = state.xp % XP_PER_LEVEL;
		const segments = 10;
		const filledSegments = Math.round((xpIntoLevel / XP_PER_LEVEL) * segments);
		const tier = this.licenseStore?.getTier?.() ?? 'free';
		const theme = getTheme(this.context.globalState.get<string>(THEME_STATE_KEY, 'default'), tier === 'paid');
		const tierLine = tier === 'paid'
			? 'PRO — Unlimited suggestions'
			: `FREE — ${this.usageStore?.getShownToday?.() ?? 0}/${FREE_DAILY_SUGGESTION_LIMIT} suggestions today`;

		const barHtml = Array.from({ length: segments }, (_, index) =>
			`<div class="seg ${index < filledSegments ? 'filled' : ''}"></div>`
		).join('');

		const badgesHtml = badgeDefinitions.map((badge) => {
			const unlocked = state.badges.includes(badge.id);
			const color = unlocked ? badge.color : 'var(--theme-highlight)';
			const opacity = unlocked ? 1 : 0.45;
			return `
				<div class="badge ${unlocked ? 'unlocked' : 'locked'}" style="color: ${color}; opacity: ${opacity};" title="${escapeHtml(badge.description)}">
					${renderPixelIcon(badge.icon, 18)}
          <span>${escapeHtml(badge.name)}</span>
        </div>`;
		}).join('');
		const questsHtml = state.dailyQuests.map((quest) => {
			const pips = Array.from({ length: quest.target }, (_, index) =>
				`<span class="pip ${index < quest.progress ? 'filled' : ''}"></span>`
			).join('');
			return `
				<div class="quest ${quest.completed ? 'completed' : ''}">
					<div class="quest-label">${quest.completed ? '&#10003; ' : ''}${escapeHtml(quest.label)}</div>
					<div class="quest-pips">${pips}</div>
				</div>`;
		}).join('');
		return /* html */ `<!DOCTYPE html>
<html><head><style>
	:root { ${themeCssVariables(theme)} }
  @font-face { font-family: 'PressStart2P'; src: url('${fontUri}') format('truetype'); }
  body {
		background: var(--theme-background);
		color: var(--theme-text);
    font-family: 'PressStart2P', monospace;
    font-size: 0.65em;
    padding: 12px;
    line-height: 1.8;
  }
	.level { color: var(--theme-accent); margin-bottom: 8px; }
	.tier { margin: 8px 0 12px; color: var(--theme-highlight); font-size: 0.75em; }
	.tier.pro { color: var(--theme-accent); }
  .bar { display: flex; gap: 2px; margin: 10px 0; }
	.seg { width: 16px; height: 12px; background: var(--theme-empty-segment); border: 1px solid var(--theme-background); }
	.seg.filled { background: var(--theme-text); }
  .fixed { margin: 10px 0; }
	.badges h4 { color: var(--theme-accent); margin: 14px 0 8px; }
	.badge { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
	.badge svg { shape-rendering: crispEdges; }
	.badge svg rect { fill: currentColor; }
  .badge span { font-size: 0.9em; }
	.quests h4 { color: var(--theme-accent); margin: 14px 0 8px; }
	.quest { margin-bottom: 10px; }
	.quest-label { font-size: 0.75em; margin-bottom: 4px; }
	.quest.completed .quest-label { color: var(--theme-text); }
	.quest-pips { display: flex; gap: 3px; }
	.pip { width: 10px; height: 10px; background: var(--theme-empty-segment); border: 1px solid var(--theme-background); }
	.pip.filled { background: var(--theme-text); }
</style></head>
<body>
  <div class="level">LEVEL ${state.level}</div>
  <div class="tier ${tier === 'paid' ? 'pro' : ''}">${tierLine}</div>
  <div class="bar">${barHtml}</div>
  <div>${xpIntoLevel} / ${XP_PER_LEVEL} XP</div>
  <div class="fixed">FIXED: ${state.vulnerabilitiesFixed}</div>
  <div class="badges">
    <h4>BADGES</h4>
    ${badgesHtml}
  </div>
	<div class="quests">
		<h4>DAILY QUESTS</h4>
		${questsHtml}
	</div>
</body></html>`;
	}
}

export class ChallengesViewProvider implements vscode.WebviewViewProvider {
	private view: vscode.WebviewView | undefined;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly stateStore: StateStore,
		private readonly licenseStore?: LicenseStore
	) {}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.view = webviewView;
		webviewView.webview.options = {
			enableScripts: false,
			localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
		};
		this.render();
	}

	refresh(): void {
		this.render();
	}

	private render(): void {
		if (!this.view) {
			return;
		}
		const fontUri = this.view.webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'media', 'fonts', 'PressStart2P-Regular.ttf')
		);
		const state = this.stateStore.getState();
		const tier = this.licenseStore?.getTier?.() ?? 'free';
		const theme = getTheme(this.context.globalState.get<string>(THEME_STATE_KEY, 'default'), tier === 'paid');
		const completedChallenges = new Set(state.completedChallengeIds ?? []);
		const challengesHtml = challengeDefinitions.map((challenge) => {
			const completed = completedChallenges.has(challenge.id);
			return `<div class="challenge ${completed ? 'completed' : 'locked'}"><span>${completed ? '[DONE]' : '[LOCKED]'}</span> ${escapeHtml(challenge.title)}</div>`;
		}).join('');

		this.view.webview.html = /* html */ `<!DOCTYPE html>
<html><head><style>
	:root { ${themeCssVariables(theme)} }
	@font-face { font-family: 'PressStart2P'; src: url('${fontUri}') format('truetype'); }
	body {
		background: var(--theme-background);
		color: var(--theme-text);
		font-family: 'PressStart2P', monospace;
		font-size: 0.65em;
		padding: 12px;
		line-height: 1.8;
	}
	.challenge { font-size: 0.95em; margin-bottom: 12px; line-height: 1.7; }
	.challenge.locked { color: var(--theme-highlight); opacity: 0.65; }
	.challenge.completed { color: var(--theme-text); }
</style></head>
<body>${challengesHtml}</body></html>`;
	}
}

function renderPixelIcon(icon: string[], size: number): string {
	const pixels = icon.flatMap((row, y) => [...row].flatMap((pixel, x) =>
		pixel === '1' ? `<rect x="${x}" y="${y}" width="1" height="1" />` : []
	));
	return `<svg viewBox="0 0 8 8" width="${size}" height="${size}" aria-hidden="true">${pixels.join('')}</svg>`;
}

function escapeHtml(text: string): string {
	const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	return text.replace(/[&<>"']/g, (character) => map[character]);
}

