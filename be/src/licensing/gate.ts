import * as vscode from 'vscode';
import { LicenseStore } from './license';

export async function requirePaid(featureName: string, licenseStore: LicenseStore): Promise<boolean> {
	if (licenseStore.isPaid()) {
		return true;
	}

	const choice = await vscode.window.showInformationMessage(
		`${featureName} is available with SecureQuest Pro.`,
		'Enter License Key'
	);
	if (choice === 'Enter License Key') {
		await vscode.commands.executeCommand('be.enterLicenseKey');
	}
	return false;
}