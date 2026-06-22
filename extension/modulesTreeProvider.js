const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

class ModuleItem extends vscode.TreeItem {
    /**
     * @param {string} label - Module display name
     * @param {object} moduleData - Parsed module entry from configEditor
     * @param {vscode.TreeItemCollapsibleState} collapsibleState
     */
    constructor(label, moduleData, collapsibleState = vscode.TreeItemCollapsibleState.None) {
        super(label, collapsibleState);

        this.moduleData = moduleData;
        this.contextValue = 'zumitoModule';

        if (moduleData.kind === 'call') {
            this.description = '⚙️ has config';
            this.tooltip = `${moduleData.name}(${JSON.stringify(moduleData.config || {})})`;
            this.iconPath = new vscode.ThemeIcon('settings-gear');
        } else {
            this.description = '';
            this.tooltip = moduleData.name;
            this.iconPath = new vscode.ThemeIcon('package');
        }

        // Context menu commands
        this.command = {
            command: 'zumito-cli.modules.select',
            title: 'Select Module',
            arguments: [moduleData],
        };
    }
}

class ModulesTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    getChildren(element) {
        if (element) {
            return Promise.resolve([]);
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return Promise.resolve([new vscode.TreeItem(
                'No workspace open',
                vscode.TreeItemCollapsibleState.None
            )]);
        }

        const configPath = path.join(workspaceFolder.uri.fsPath, 'zumito.config.ts');
        if (!fs.existsSync(configPath)) {
            const item = new vscode.TreeItem(
                'No zumito.config.ts found',
                vscode.TreeItemCollapsibleState.None
            );
            item.description = 'Create a Zumito project first';
            return Promise.resolve([item]);
        }

        return this.loadModules(configPath);
    }

    async loadModules(configPath) {
        try {
            // Dynamic import because configEditor is ESM
            const { getInstalledModules } = await import(
                path.join(__dirname, '..', 'lib', 'utils', 'configEditor.js')
            );

            const modules = getInstalledModules(configPath);

            if (modules.length === 0) {
                const item = new vscode.TreeItem(
                    'No external modules installed',
                    vscode.TreeItemCollapsibleState.None
                );
                item.description = 'Run "Zumito: Install Module" to add one';
                return [item];
            }

            return modules.map(mod => {
                const label = mod.kind === 'call' ? `${mod.name}()` : mod.name;
                return new ModuleItem(label, mod);
            });
        } catch (err) {
            const item = new vscode.TreeItem(
                'Error loading modules',
                vscode.TreeItemCollapsibleState.None
            );
            item.description = err.message;
            return [item];
        }
    }
}

module.exports = { ModulesTreeProvider, ModuleItem };
