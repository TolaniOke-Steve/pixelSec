import * as vscode from 'vscode';
import { BadgeDefinition } from '../gamification/badges';
import { Theme, themes, themeCssVariables } from './themes';

let activePanel: vscode.WebviewPanel | undefined;

export function showXPPopup(context: vscode.ExtensionContext, message: string, xpAmount: number, theme: Theme = themes[0]): void {
	activePanel?.dispose();

	activePanel = vscode.window.createWebviewPanel(
		'secureQuestPopup',
		'SecureQuest',
		{ viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
		{
			enableScripts: false,
			retainContextWhenHidden: false,
			localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
		}
	);

	const popupFontUri = activePanel.webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, 'media', 'fonts', 'PressStart2P-Regular.ttf')
	);
	activePanel.webview.html = getPopupHtml(message, xpAmount, popupFontUri.toString(), theme);

	const panelRef = activePanel;
	setTimeout(() => panelRef.dispose(), 3000);
	activePanel.onDidDispose(() => {
		if (activePanel === panelRef) {
			activePanel = undefined;
		}
	});
}

export function showBadgePopup(context: vscode.ExtensionContext, badges: BadgeDefinition[], theme: Theme = themes[0]): void {
	if (badges.length === 0) {
		return;
	}

	activePanel?.dispose();
	activePanel = vscode.window.createWebviewPanel(
		'secureQuestBadgePopup',
		'Badge Unlocked',
		{ viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
		{
			enableScripts: false,
			retainContextWhenHidden: false,
			localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
		}
	);

	const popupFontUri = activePanel.webview.asWebviewUri(
		vscode.Uri.joinPath(context.extensionUri, 'media', 'fonts', 'PressStart2P-Regular.ttf')
	);
	activePanel.webview.html = getBadgePopupHtml(badges, popupFontUri.toString(), theme);

	const panelRef = activePanel;
	setTimeout(() => panelRef.dispose(), 4000);
	activePanel.onDidDispose(() => {
		if (activePanel === panelRef) {
			activePanel = undefined;
		}
	});
}

function getPopupHtml(message: string, xpAmount: number, fontUri: string, theme: Theme): string {
	return /* html */ `<!DOCTYPE html>
<html><head><style>
	:root { ${themeCssVariables(theme)} }
	@font-face {
		font-family: 'PressStart2P';
		src: url('${fontUri}') format('truetype');
	}
  body {
	background: var(--theme-background);
	color: var(--theme-text);
		font-family: 'PressStart2P', monospace;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    margin: 0;
	text-shadow: 2px 2px var(--theme-background);
  }
	.xp { font-size: 1.4em; color: var(--theme-accent); animation: pop 0.3s ease-out; }
	.msg { font-size: 0.7em; margin-top: 12px; text-align: center; padding: 0 20px; }
  @keyframes pop { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style></head>
<body>
  <div class="xp">+${xpAmount} XP</div>
  <div class="msg">${escapeHtml(message)}</div>
</body></html>`;
}

function getBadgePopupHtml(badges: BadgeDefinition[], fontUri: string, theme: Theme): string {
	const badgesHtml = badges.map((badge) => `
		<section class="badge" style="color: ${badge.color};">
			${renderPixelIcon(badge.icon, 48)}
			<div>
				<div class="name">${escapeHtml(badge.name)}</div>
				<div class="description">${escapeHtml(badge.description)}</div>
			</div>
		</section>`).join('');

	return /* html */ `<!DOCTYPE html>
<html><head><style>
	:root { ${themeCssVariables(theme)} }
	@font-face { font-family: 'PressStart2P'; src: url('${fontUri}') format('truetype'); }
	body {
		background: var(--theme-background);
		color: var(--theme-text);
		font-family: 'PressStart2P', monospace;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		margin: 0;
		padding: 20px;
		box-sizing: border-box;
		text-shadow: 2px 2px var(--theme-background);
	}
	h1 { font-size: 1em; color: var(--theme-accent); margin: 0 0 20px; animation: pop 0.3s ease-out; }
	.badge { display: flex; align-items: center; gap: 16px; max-width: 420px; margin: 8px 0; animation: pop 0.3s ease-out; }
	.badge svg { flex: 0 0 auto; shape-rendering: crispEdges; }
	.badge svg rect { fill: currentColor; }
	.name { font-size: 0.85em; color: currentColor; }
	.description { color: var(--theme-highlight); font-size: 0.55em; margin-top: 8px; line-height: 1.8; }
	@keyframes pop { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style></head>
<body>
	<h1>BADGE UNLOCKED!</h1>
	${badgesHtml}
</body></html>`;
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
