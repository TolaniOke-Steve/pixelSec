export interface Theme {
	id: string;
	name: string;
	background: string;
	text: string;
	accent: string;
	highlight: string;
	emptySegment: string;
}

export const themes: Theme[] = [
	{
		id: 'default',
		name: 'Default Arcade',
		background: '#0f0f1a',
		text: '#7CFC00',
		accent: '#FFD700',
		highlight: '#B0B0B0',
		emptySegment: '#333333',
	},
	{
		id: 'gameboy',
		name: 'Gameboy Green',
		background: '#0f380f',
		text: '#9bbc0f',
		accent: '#8bac0f',
		highlight: '#c4d46a',
		emptySegment: '#306230',
	},
	{
		id: 'amber',
		name: 'Amber Terminal',
		background: '#201408',
		text: '#ffb000',
		accent: '#ffd166',
		highlight: '#d18a24',
		emptySegment: '#573813',
	},
	{
		id: 'synthwave',
		name: 'Synthwave Purple',
		background: '#180d24',
		text: '#f3a6ff',
		accent: '#ff5ea8',
		highlight: '#c7a0db',
		emptySegment: '#493052',
	},
	{
		id: 'ocean',
		name: 'Ocean Byte',
		background: '#09252b',
		text: '#75e6da',
		accent: '#ffca6b',
		highlight: '#a7c9ce',
		emptySegment: '#28535a',
	},
];

export function getTheme(themeId: string | undefined, isPaid: boolean): Theme {
	if (!isPaid) {
		return themes[0];
	}
	return themes.find((theme) => theme.id === themeId) ?? themes[0];
}

export function themeCssVariables(theme: Theme): string {
	return `--theme-background:${theme.background};--theme-text:${theme.text};--theme-accent:${theme.accent};--theme-highlight:${theme.highlight};--theme-empty-segment:${theme.emptySegment};`;
}