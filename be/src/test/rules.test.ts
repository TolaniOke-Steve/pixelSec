import * as assert from 'assert';
import { insecureCryptoRule } from '../rules/insecureCrypto';
import { rules } from '../rules';
import { unsafeRegexRule } from '../rules/unsafeRegex';
import { dangerousEvalRule } from '../rules/dangerousEval';
import { advancedRules } from '../rules/advanced';

suite('Security rules', () => {
	test('detects catastrophic regex shapes in literals and RegExp calls', () => {
		const findings = unsafeRegexRule.scan(`
			const literal = /(a+)+$/;
			const constructed = new RegExp('(a|a)*');
		`);

		assert.strictEqual(findings.length, 2);
		assert.match(findings[0].message, /nested quantified groups/);
		assert.match(findings[1].message, /quantified alternation/);
	});

	test('detects broken hash algorithms but ignores Math.random', () => {
		const findings = insecureCryptoRule.scan(`
			crypto.createHash('md5');
			crypto.createHash("SHA1");
			Math.random();
		`);

		assert.strictEqual(findings.length, 2);
		assert.match(findings[0].message, /MD5/);
		assert.match(findings[0].message, /SHA-256/);
		assert.match(findings[1].message, /SHA1/);
		assert.strictEqual(rules.includes(unsafeRegexRule), true);
		assert.strictEqual(rules.includes(insecureCryptoRule), true);
	});

	test('detects dynamic code execution APIs and string timers', () => {
		const findings = dangerousEvalRule.scan(`
			eval(input);
			new Function(input);
			setTimeout('runTask()', 10);
			setInterval("runTask()", 10);
			setTimeout(runTask, 10);
		`);

		assert.strictEqual(findings.length, 4);
		assert.strictEqual(findings.every((finding) => finding.xp === 20), true);
		assert.strictEqual(rules.includes(dangerousEvalRule), true);
	});

	test('advanced paid rules detect narrow high-confidence unsafe patterns', () => {
		const examples: Record<string, string> = {
			'sql-injection': 'db.query(`SELECT * FROM users WHERE id = ${userId}`);',
			'xss-sink': 'element.innerHTML = userInput;',
			'command-injection': 'exec(`cat ${fileName}`);',
			'disabled-tls-verification': 'https.request({ rejectUnauthorized: false });',
			'insecure-jwt': "jwt.verify(token, secret, { algorithms: ['none'] });",
			'cors-wildcard-credentials': "cors({ origin: '*', credentials: true });",
		};

		for (const rule of advancedRules) {
			assert.strictEqual(rule.tier, 'paid');
			assert.strictEqual(rule.scan(examples[rule.id]).length, 1, `${rule.id} should match its vulnerable example`);
		}
		assert.strictEqual(advancedRules.find((rule) => rule.id === 'xss-sink')?.scan('element.textContent = userInput;').length, 0);
	});
});