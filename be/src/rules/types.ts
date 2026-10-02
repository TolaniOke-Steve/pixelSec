import * as vscode from 'vscode';

export interface RuleFinding {
	key?: string;
	index?: number;
	length?: number;
	message: string;
	xp?: number;
	range?: vscode.Range;
}

export interface Rule {
	id: string;
	xpReward: number;
	tier: 'free' | 'paid';
	owaspCategory?: string;
	explanation?: string;
	scan(text: string): RuleFinding[];
	detect?(document: vscode.TextDocument): RuleFinding[];
}