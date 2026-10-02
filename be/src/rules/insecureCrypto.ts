import { Rule } from './types';

const hashPattern = /createHash\s*\(\s*(['"])(md5|sha1)\1\s*\)/gi;

export const insecureCryptoRule: Rule = {
	id: 'insecure-crypto',
	xpReward: 10,
	tier: 'free',
	scan(text) {
		return Array.from(text.matchAll(hashPattern), (match) => {
			const algorithm = match[2].toUpperCase();
			return {
				index: match.index ?? 0,
				length: match[0].length,
				message: `Insecure hash algorithm ${algorithm} detected. Use SHA-256 or stronger instead.`,
				xp: 10,
			};
		});
	},
	detect(document) {
		return insecureCryptoRule.scan(document.getText()).map((finding, index) => ({
			...finding,
			key: `${insecureCryptoRule.id}:${index}:${finding.message}`,
		}));
	},
};