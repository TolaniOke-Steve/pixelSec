import { Rule, RuleFinding } from './types';

const dangerousEvalPattern = /\b(?:eval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*['"`]|setInterval\s*\(\s*['"`])/g;

export const dangerousEvalRule: Rule = {
	id: 'dangerous-eval',
	xpReward: 20,
	tier: 'free',
	scan(text) {
		return Array.from(text.matchAll(dangerousEvalPattern), (match) => ({
			index: match.index ?? 0,
			length: match[0].length,
			message: 'Dynamic code execution (eval/Function/string-timer) can lead to code injection — avoid evaluating strings as code.',
			xp: 20,
		}));
	},
	detect(document) {
		return dangerousEvalRule.scan(document.getText()).map((finding, index) => ({
			...finding,
			key: `${dangerousEvalRule.id}:${index}:${finding.message}`,
		}));
	},
};