import { Rule, RuleFinding } from './types';

interface PatternRuleOptions {
	id: string;
	message: string;
	category: string;
	explanation: string;
	pattern: RegExp;
}

function patternRule(options: PatternRuleOptions): Rule {
	return {
		id: options.id,
		xpReward: 20,
		tier: 'paid',
		owaspCategory: options.category,
		explanation: options.explanation,
		scan(text): RuleFinding[] {
			return Array.from(text.matchAll(new RegExp(options.pattern.source, options.pattern.flags)), (match) => ({
				index: match.index ?? 0,
				length: match[0].length,
				message: options.message,
				xp: 20,
			}));
		},
		detect(document) {
			return this.scan(document.getText()).map((finding, index) => ({
				...finding,
				key: `${options.id}:${index}:${finding.index}`,
			}));
		},
	};
}

export const advancedRules: Rule[] = [
	patternRule({
		id: 'sql-injection',
		message: 'Possible SQL injection: query text is built with interpolation or concatenation.',
		category: 'A03:2021 Injection',
		explanation: 'Bind untrusted values as query parameters instead of composing SQL text.',
		pattern: /(?:query|execute|raw)\s*\(\s*(?:`[^`]*\$\{|['"][^'"]*['"]\s*\+)/gi,
	}),
	patternRule({
		id: 'xss-sink',
		message: 'Unsafe HTML output sink detected.',
		category: 'A03:2021 Injection',
		explanation: 'Avoid inserting untrusted strings as HTML; use textContent or a vetted sanitizer.',
		pattern: /(?:\.innerHTML\s*=|document\.write\s*\(|dangerouslySetInnerHTML\s*=)/g,
	}),
	patternRule({
		id: 'command-injection',
		message: 'Possible command injection: shell command uses a template literal.',
		category: 'A03:2021 Injection',
		explanation: 'Use an argument array and avoid passing user-controlled text to a shell.',
		pattern: /(?:exec|execSync)\s*\(\s*`[^`]*\$\{/g,
	}),
	patternRule({
		id: 'disabled-tls-verification',
		message: 'TLS certificate verification is disabled.',
		category: 'A02:2021 Cryptographic Failures',
		explanation: 'Keep certificate verification enabled so the peer identity is validated.',
		pattern: /rejectUnauthorized\s*:\s*false\b/g,
	}),
	patternRule({
		id: 'insecure-jwt',
		message: 'JWT verification appears disabled or uses the none algorithm.',
		category: 'A07:2021 Identification and Authentication Failures',
		explanation: 'Verify signatures with an explicit allowlist of trusted algorithms.',
		pattern: /(?:algorithms\s*:\s*\[\s*['"]none['"]|jwt\.decode\s*\()/gi,
	}),
	patternRule({
		id: 'cors-wildcard-credentials',
		message: 'CORS wildcard origin is configured together with credentials.',
		category: 'A05:2021 Security Misconfiguration',
		explanation: 'Allow only trusted origins when credentials are enabled.',
		pattern: /(?:origin\s*:\s*['"]\*['"][\s\S]{0,160}credentials\s*:\s*true|credentials\s*:\s*true[\s\S]{0,160}origin\s*:\s*['"]\*['"])/g,
	}),
];