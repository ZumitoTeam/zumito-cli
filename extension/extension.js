const vscode = require('vscode');
const path = require('path');

function runCLI(args) {
    const cliPath = path.join(__dirname, '..', 'bin', 'index.js');
    const command = `node ${cliPath} ${args}`;
    const terminal = vscode.window.createTerminal('Zumito CLI');
    terminal.sendText(command);
    terminal.show();
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

        const databaseType = await vscode.window.showQuickPick([
            'sqlite', 'mysql', 'postgres', 'mongodb', 'tingodb', 'couchdb'
        ], { placeHolder: 'Database type' });
        if (!databaseType) { return; }

        runCLI(
            `create project --projectName "${name}" ` +
            `--discordToken "${discordToken}" ` +
            `--discordClientId "${discordClientId}" ` +
            `--discordClientSecret "${discordClientSecret}" ` +
            `--botPrefix "${botPrefix}" ` +
            `--databaseType "${databaseType}"`
        );
    });

    const createModule = vscode.commands.registerCommand('zumito-cli.createModule', async () => {
        const moduleName = await vscode.window.showInputBox({ prompt: 'Module name' });
        if (!moduleName) { return; }

        const moduleType = await vscode.window.showQuickPick(['common', 'custom_behavior'], { placeHolder: 'Module type' });
        if (!moduleType) { return; }

        runCLI(`create module --name "${moduleName}" --type "${moduleType}"`);
    });

    context.subscriptions.push(createProject, createModule);
}

function deactivate() {}

module.exports = { activate, deactivate };
