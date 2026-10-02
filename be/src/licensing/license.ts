import * as vscode from 'vscode';

const LICENSE_STATE_KEY = 'be.license';

export type Tier = 'free' | 'paid';

export interface LicenseState {
	tier: Tier;
	licenseKey?: string;
}

const DEFAULT_LICENSE: LicenseState = { tier: 'free' };

function isValidLicenseKeyFormat(key: string): boolean {
	return key.startsWith('SQ-') && key.length >= 12;
}

export function createLicenseStore(context: vscode.ExtensionContext) {
	function readLicense(): LicenseState {
		return context.globalState.get<LicenseState>(LICENSE_STATE_KEY, DEFAULT_LICENSE);
	}

	return {
		getTier(): Tier {
			return readLicense().tier;
		},
		isPaid(): boolean {
			return readLicense().tier === 'paid';
		},
		async activate(key: string): Promise<boolean> {
			if (!isValidLicenseKeyFormat(key)) {
				return false;
			}
			await context.globalState.update(LICENSE_STATE_KEY, { tier: 'paid', licenseKey: key });
			return true;
		},
		async deactivate(): Promise<void> {
			await context.globalState.update(LICENSE_STATE_KEY, DEFAULT_LICENSE);
		},
	};
}

export type LicenseStore = ReturnType<typeof createLicenseStore>;
