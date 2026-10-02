import * as vscode from 'vscode';
import { rules } from '../rules';
import { Tier } from '../licensing/license';

export interface AnalysisFinding {
	key: string;
	xp: number;
	diagnostic: vscode.Diagnostic;
}

export function analyzeDocument(document: vscode.TextDocument, tier: Tier): AnalysisFinding[] {
	const activeRules = rules.filter((rule) => rule.tier === 'free' || tier === 'paid');
	const results: AnalysisFinding[] = [];

	for (const rule of activeRules) {
		const findings = rule.detect ? rule.detect(document) : [];
		for (const finding of findings) {
			const diagnostic = new vscode.Diagnostic(
				finding.range ?? new vscode.Range(
					document.positionAt(finding.index ?? 0),
					document.positionAt((finding.index ?? 0) + (finding.length ?? 0))
				),
				finding.message,
				vscode.DiagnosticSeverity.Warning
			);
			diagnostic.source = 'be';
			diagnostic.code = rule.id;
			results.push({
				key: finding.key ?? `${rule.id}:${finding.message}:${finding.index ?? 0}`,
				xp: finding.xp ?? rule.xpReward,
				diagnostic,
			});
		}
	}

	return results;
}
