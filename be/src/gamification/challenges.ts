export interface Challenge {
	id: string;
	title: string;
	category: string;
	vulnerableSnippet: string;
	ruleId: string;
	hint: string;
	xpReward: number;
}

export const challengeDefinitions: Challenge[] = [
	{
		id: 'challenge-sql-interpolation',
		title: 'Parameterize the Query',
		category: 'A03:2021 Injection',
		vulnerableSnippet: 'db.query(`SELECT * FROM users WHERE id = ${userId}`);',
		ruleId: 'sql-injection',
		hint: 'Keep query structure separate from user-controlled values.',
		xpReward: 25,
	},
	{
		id: 'challenge-xss-sink',
		title: 'Render Text Safely',
		category: 'A03:2021 Injection',
		vulnerableSnippet: 'element.innerHTML = userInput;',
		ruleId: 'xss-sink',
		hint: 'Prefer textContent when the value should be displayed as text.',
		xpReward: 25,
	},
	{
		id: 'challenge-shell-interpolation',
		title: 'Stop Shell Injection',
		category: 'A03:2021 Injection',
		vulnerableSnippet: 'exec(`cat ${fileName}`);',
		ruleId: 'command-injection',
		hint: 'Avoid shell interpolation; pass a program and separate arguments.',
		xpReward: 25,
	},
	{
		id: 'challenge-tls-verification',
		title: 'Verify the Server',
		category: 'A02:2021 Cryptographic Failures',
		vulnerableSnippet: 'https.request({ rejectUnauthorized: false });',
		ruleId: 'disabled-tls-verification',
		hint: 'Restore certificate verification instead of suppressing TLS errors.',
		xpReward: 20,
	},
	{
		id: 'challenge-jwt-none',
		title: 'Verify JWT Signatures',
		category: 'A07:2021 Identification and Authentication Failures',
		vulnerableSnippet: "jwt.verify(token, secret, { algorithms: ['none'] });",
		ruleId: 'insecure-jwt',
		hint: 'Allow only a trusted signing algorithm and verify the signature.',
		xpReward: 25,
	},
	{
		id: 'challenge-cors-credentials',
		title: 'Restrict Credentialed Origins',
		category: 'A05:2021 Security Misconfiguration',
		vulnerableSnippet: "app.use(cors({ origin: '*', credentials: true }));",
		ruleId: 'cors-wildcard-credentials',
		hint: 'Replace the wildcard with an explicit list of trusted origins.',
		xpReward: 20,
	},
];