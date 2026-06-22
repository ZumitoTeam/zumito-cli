const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * Open an interactive config editor for a module.
 * Shows inputs for each config key with current values as defaults.
 * @param {object} moduleData - Parsed module entry {name, config, kind}
 */
async function editModuleConfig(moduleData) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const configPath = path.join(workspaceFolder.uri.fsPath, 'zumito.config.ts');
    if (!fs.existsSync(configPath)) {
        vscode.window.showErrorMessage('No zumito.config.ts found in workspace');
        return;
    }

    const currentConfig = moduleData.config || {};

    const action = await vscode.window.showQuickPick(
        [
            { label: '$(edit) Edit existing values', value: 'edit' },
            { label: '$(add) Add new key', value: 'add' },
            { label: '$(remove) Remove a key', value: 'remove' },
            { label: '$(clear-all) Clear all config', value: 'clear' },
            { label: '$(close) Cancel', value: 'cancel' },
        ],
        { placeHolder: `Configure ${moduleData.name}` }
    );

    if (!action || action.value === 'cancel') return;

    let newConfig = { ...currentConfig };

    try {
        if (action.value === 'edit') {
            const keys = Object.keys(newConfig);
            if (keys.length === 0) {
                vscode.window.showInformationMessage('No existing config to edit. Add a key first.');
                return;
            }

            for (const key of keys) {
                const currentVal = newConfig[key];
                const valStr = typeof currentVal === 'string'
                    ? currentVal
                    : JSON.stringify(currentVal);

                const result = await vscode.window.showInputBox({
                    prompt: `${key}:`,
                    value: valStr,
                    placeHolder: 'Enter value (string, number, true/false, or JSON)',
                });

                if (result !== undefined) {
                    newConfig[key] = parseInputValue(result);
                }
            }
        } else if (action.value === 'add') {
            const key = await vscode.window.showInputBox({
                prompt: 'Key name:',
                validateInput: (val) => val.trim() ? null : 'Key name cannot be empty',
            });
            if (!key) return;

            const value = await vscode.window.showInputBox({
                prompt: `Value for "${key}":`,
                placeHolder: 'Enter value (string, number, true/false, or JSON)',
            });
            if (value !== undefined) {
                newConfig[key] = parseInputValue(value);
            }
        } else if (action.value === 'remove') {
            const keys = Object.keys(newConfig);
            if (keys.length === 0) {
                vscode.window.showInformationMessage('No keys to remove.');
                return;
            }

            const key = await vscode.window.showQuickPick(keys, {
                placeHolder: 'Select key to remove',
            });
            if (key) {
                delete newConfig[key];
            }
        } else if (action.value === 'clear') {
            newConfig = {};
        }

        // Import configEditor and save
        const { updateModuleConfig } = await import(
            path.join(__dirname, '..', 'lib', 'utils', 'configEditor.js')
        );

        updateModuleConfig(configPath, moduleData.name, newConfig);
        vscode.window.showInformationMessage(`Configuration for "${moduleData.name}" updated`);

        // Refresh tree
        vscode.commands.executeCommand('zumito-cli.modules.refresh');
    } catch (err) {
        vscode.window.showErrorMessage(`Failed to update config: ${err.message}`);
    }
}

function parseInputValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
    if (/^\{/.test(value) || /^\[/.test(value)) {
        try { return JSON.parse(value); } catch { return value; }
    }
    return value;
}

module.exports = { editModuleConfig };
