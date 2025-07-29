const vscode = require('vscode');
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

function runCLI(args) {
    const command = `npx zumito-cli ${args}`;
    const terminal = vscode.window.createTerminal('Zumito CLI');
    terminal.sendText(command);
    terminal.show();
}

function findServiceFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            findServiceFiles(fullPath, fileList);
        } else if (fullPath.toLowerCase().includes('services') && file.endsWith('.ts')) {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

function activate(context) {
    const createProject = vscode.commands.registerCommand('zumito-cli.createProject', async () => {
        const name = await vscode.window.showInputBox({ prompt: 'Project name' });
        if (!name) { return; }

        const discordToken = await vscode.window.showInputBox({ prompt: 'Discord bot token' });
        if (!discordToken) { return; }

        const discordClientId = await vscode.window.showInputBox({ prompt: 'Discord client ID' });
        if (!discordClientId) { return; }

        const discordClientSecret = await vscode.window.showInputBox({ prompt: 'Discord client secret' });
        if (!discordClientSecret) { return; }

        const botPrefix = await vscode.window.showInputBox({ prompt: 'Default prefix', value: 'zt-' });
        if (!botPrefix) { return; }

        const mongoQueryString = await vscode.window.showInputBox({ prompt: 'Mongo query string' });
        if (!mongoQueryString) { return; }

        runCLI(
            `create project --projectName "${name}" ` +
            `--discordToken "${discordToken}" ` +
            `--discordClientId "${discordClientId}" ` +
            `--discordClientSecret "${discordClientSecret}" ` +
            `--botPrefix "${botPrefix}" ` +
            `--mongoQueryString "${mongoQueryString}"`
        );
    });

    const createModule = vscode.commands.registerCommand('zumito-cli.createModule', async () => {
        const moduleName = await vscode.window.showInputBox({ prompt: 'Module name' });
        if (!moduleName) { return; }

        const moduleType = await vscode.window.showQuickPick(['common', 'custom_behavior'], { placeHolder: 'Module type' });
        if (!moduleType) { return; }

        runCLI(`create module --name "${moduleName}" --type "${moduleType}"`);
    });

    const listModules = (workspaceFolder) => {
        const modulesPath = path.join(workspaceFolder, 'src', 'modules');
        if (!fs.existsSync(modulesPath)) return [];
        return fs.readdirSync(modulesPath).filter(f => {
            return fs.statSync(path.join(modulesPath, f)).isDirectory();
        });
    };

    const createEmbedBuilder = vscode.commands.registerCommand('zumito-cli.createEmbedBuilder', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        let moduleName;
        if (workspaceFolder) {
            const modules = listModules(workspaceFolder);
            if (modules.length > 0) {
                moduleName = await vscode.window.showQuickPick(modules, { placeHolder: 'Module name' });
            }
        }
        if (!moduleName) {
            moduleName = await vscode.window.showInputBox({ prompt: 'Module name' });
        }
        if (!moduleName) { return; }

        const serviceName = await vscode.window.showInputBox({ prompt: 'Service name' });
        if (!serviceName) { return; }

        runCLI(`create embedBuilder --moduleName "${moduleName}" --name "${serviceName}"`);
    });

    const createActionRowBuilder = vscode.commands.registerCommand('zumito-cli.createActionRowBuilder', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        let moduleName;
        if (workspaceFolder) {
            const modules = listModules(workspaceFolder);
            if (modules.length > 0) {
                moduleName = await vscode.window.showQuickPick(modules, { placeHolder: 'Module name' });
            }
        }
        if (!moduleName) {
            moduleName = await vscode.window.showInputBox({ prompt: 'Module name' });
        }
        if (!moduleName) { return; }

        const serviceName = await vscode.window.showInputBox({ prompt: 'Service name' });
        if (!serviceName) { return; }

        runCLI(`create actionRowBuilder --moduleName "${moduleName}" --name "${serviceName}"`);
    });

    const injectServiceCmd = vscode.commands.registerCommand('zumito-cli.injectService', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found. Please open a TypeScript file.');
            return;
        }

        if (editor.document.isDirty) {
            const save = await vscode.window.showWarningMessage(
                'The file has unsaved changes. Do you want to save it before proceeding?',
                { modal: true },
                'Save'
            );
            if (save !== 'Save') {
                vscode.window.showErrorMessage('Operation cancelled because the file was not saved.');
                return;
            }
            await editor.document.save();
        }

        const file = editor.document.fileName;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found.');
            return;
        }

        let services = [];
        try {
            services = findServiceFiles(workspaceFolder).map(fullPath => {
                const filename = path.basename(fullPath, '.ts');
                return `${fullPath}:${filename}`;
            });
        } catch (e) {
            vscode.window.showErrorMessage('Failed to list services');
            return;
        }

        const pick = await vscode.window.showQuickPick(services.map(s => {
            const [p, f] = s.split(':');
            return { label: f, description: p };
        }), { placeHolder: 'Select service to inject' });
        if (!pick) { return; }

        const className = path.basename(pick.description, '.ts');
        const relativePath = path.relative(path.dirname(file), pick.description).replace(/\\/g,'/').replace(/\.ts$/, '');
        const defaultName = className.charAt(0).toLowerCase() + className.slice(1);
        const propertyName = await vscode.window.showInputBox({ prompt: 'Property name', value: defaultName });
        if (!propertyName) { return; }

        runCLI(`add injectService --file "${file}" --servicePath "${relativePath}" --serviceClass "${className}" --propertyName "${propertyName}"`);
    });

    context.subscriptions.push(createProject, createModule, createEmbedBuilder, createActionRowBuilder, injectServiceCmd);
}

function deactivate() {}

module.exports = { activate, deactivate };
