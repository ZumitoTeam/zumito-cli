const vscode = require('vscode');
const path = require('path');
const { spawnSync } = require('child_process');
const fs = require('fs');
const { createWebview } = require('./modulesWebview.js');

function getProjectRoot() {
    return vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || null;
}

function cliPath() {
    return path.join(__dirname, '..', 'bin', 'index.js');
}

function runCliJson(args) {
    const root = getProjectRoot();
    if (!root) return null;
    try {
        const r = spawnSync('node', [cliPath(), ...args.split(' ')], { cwd: root, encoding: 'utf-8' });
        if (r.status !== 0) return null;
        return JSON.parse(r.stdout);
    } catch { return null; }
}

function runCliSave(args) {
    const root = getProjectRoot();
    if (!root) return;
    try {
        spawnSync('node', [cliPath(), ...args], { cwd: root, encoding: 'utf-8' });
    } catch {}
}

/**
 * Open the module management WebView panel.
 */
async function openModulesPanel(context) {
    const root = getProjectRoot();
    if (!root) { vscode.window.showErrorMessage('Open a workspace first'); return; }
    if (!fs.existsSync(path.join(root, 'zumito.config.ts'))) {
        vscode.window.showErrorMessage('No zumito.config.ts found'); return;
    }
    createWebview(context);
}

function activate(context) {
    console.log('[Zumito] Extension activating...');

    const configure = vscode.commands.registerCommand('zumito-cli.modules.configure', () => {
        openModulesPanel(context);
    });

    const installCmd = vscode.commands.registerCommand('zumito-cli.modules.install', async () => {
        const root = getProjectRoot();
        if (!root) { vscode.window.showErrorMessage('Open a workspace first'); return; }
        const configPath = path.join(root, 'zumito.config.ts');
        if (!fs.existsSync(configPath)) { vscode.window.showErrorMessage('No zumito.config.ts found'); return; }

        const name = await vscode.window.showInputBox({ prompt: 'Module npm package name', placeHolder: '@zumito-team/analytics-module' });
        if (!name) return;

        const opt = await vscode.window.showQuickPick([
            { label: 'Add to config + npm install', value: 'install' },
            { label: 'Add to config only', value: 'config' },
            { label: 'Cancel', value: 'cancel' },
        ], { placeHolder: name });
        if (!opt || opt.value === 'cancel') return;

        runCliSave(['module', 'set-config', '--name', name, '--config', '{}']);
        if (opt.value === 'install') {
            const t = vscode.window.createTerminal({ name: 'Zumito' });
            t.sendText(`npm install ${name}`);
            t.show();
        }
        vscode.window.showInformationMessage(`Module ${name} added`);
    });

    const uninstallCmd = vscode.commands.registerCommand('zumito-cli.modules.uninstall', async () => {
        const root = getProjectRoot();
        if (!root) return;
        const modules = runCliJson('module list --json');
        if (!modules || modules.length === 0) { vscode.window.showInformationMessage('No modules to remove'); return; }

        const pick = await vscode.window.showQuickPick(modules.map(m => m.name), { placeHolder: 'Select module to remove' });
        if (!pick) return;

        const ok = await vscode.window.showWarningMessage(`Remove ${pick} from config?`, { modal: true }, 'Remove');
        if (ok !== 'Remove') return;

        runCliSave(['module', 'remove', '--name', pick]);
        vscode.window.showInformationMessage(`Module ${pick} removed`);

        const un = await vscode.window.showInformationMessage(`npm uninstall ${pick}?`, 'Yes', 'No');
        if (un === 'Yes') {
            const t = vscode.window.createTerminal({ name: 'Zumito' });
            t.sendText(`npm uninstall ${pick}`);
            t.show();
        }
    });

    const createProject = vscode.commands.registerCommand('zumito-cli.createProject', async () => {
        const folder = await vscode.window.showOpenDialog({ canSelectFolders: true, title: 'Select folder' });
        if (!folder) return;
        const targetDir = folder[0].fsPath;

        const name = await vscode.window.showInputBox({ prompt: 'Project name' });
        if (!name) return;
        const token = await vscode.window.showInputBox({ prompt: 'Discord bot token' });
        if (!token) return;
        const cid = await vscode.window.showInputBox({ prompt: 'Discord client ID' });
        if (!cid) return;
        const cs = await vscode.window.showInputBox({ prompt: 'Discord client secret' });
        if (!cs) return;
        const prefix = await vscode.window.showInputBox({ prompt: 'Default prefix', value: 'zt-' });
        if (!prefix) return;
        const mongo = await vscode.window.showInputBox({ prompt: 'Mongo query string' });

        const args = [
            'create project',
            `--projectName`, name,
            `--discordToken`, token,
            `--discordClientId`, cid,
            `--discordClientSecret`, cs,
            `--botPrefix`, prefix,
        ];
        if (mongo) args.push('--mongoQueryString', mongo);

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Creating project...' },
            async () => {
                const r = spawnSync('node', [cliPath(), ...args], { cwd: targetDir, encoding: 'utf-8', stdio: 'inherit' });
                if (r.status !== 0) { vscode.window.showErrorMessage('Failed'); return; }
                const pd = path.join(targetDir, name);
                const o = await vscode.window.showInformationMessage(`Project created at ${pd}`, 'Open');
                if (o) await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(pd));
            }
        );
    });

    context.subscriptions.push(createProject, configure, installCmd, uninstallCmd);

    // Keep the old commands working but with native dialogs
    context.subscriptions.push(
        vscode.commands.registerCommand('zumito-cli.createModule', async () => {
            var name = await vscode.window.showInputBox({ prompt: 'Module name' });
            if (!name) return;
            var type = await vscode.window.showQuickPick(['common', 'custom_behavior'], { placeHolder: 'Module type' });
            if (!type) return;
            var t = vscode.window.createTerminal({ name: 'Zumito CLI' });
            t.sendText('node "' + cliPath() + '" create module --name "' + name + '" --type "' + type + '"');
            t.show();
        }),
        vscode.commands.registerCommand('zumito-cli.createEmbedBuilder', () => {
            vscode.window.showInformationMessage('Use terminal: npx zumito-cli create embedBuilder');
        }),
        vscode.commands.registerCommand('zumito-cli.createActionRowBuilder', () => {
            vscode.window.showInformationMessage('Use terminal: npx zumito-cli create actionRowBuilder');
        }),
        vscode.commands.registerCommand('zumito-cli.injectService', () => {
            vscode.window.showInformationMessage('Use terminal: npx zumito-cli add injectService');
        }),
        vscode.commands.registerCommand('zumito-cli.runDev', () => {
            const t = vscode.window.createTerminal({ name: 'Zumito Dev' });
            t.sendText('npm run dev');
            t.show();
        }),
        vscode.commands.registerCommand('zumito-cli.runDebug', () => {
            vscode.commands.executeCommand('workbench.action.debug.start');
        }),
        vscode.commands.registerCommand('zumito-cli.createCommand', async (uri) => {
            // Derive module name from the selected folder path
            var moduleName = '';
            if (uri && uri.fsPath) {
                var p = uri.fsPath;
                var stat = require('fs').statSync(p);
                if (stat.isFile()) p = path.dirname(p);
                // Walk up to find the module folder (parent of commands/)
                var parts = p.split(path.sep);
                var idx = parts.indexOf('commands');
                if (idx > 0) moduleName = parts[idx - 1];
                else {
                    // Try parent dir name
                    moduleName = path.basename(path.dirname(p));
                }
            }
            if (!moduleName) {
                moduleName = await vscode.window.showInputBox({ prompt: 'Module name', placeHolder: 'myModule' });
                if (!moduleName) return;
            }
            var name = await vscode.window.showInputBox({ prompt: 'Command name', placeHolder: 'ping' });
            if (!name) return;
            var type = await vscode.window.showQuickPick(['prefix', 'slash', 'any'], { placeHolder: 'Command type' });
            if (!type) return;
            var t = vscode.window.createTerminal({ name: 'Zumito CLI' });
            t.sendText('node "' + cliPath() + '" create command --moduleName "' + moduleName + '" --name "' + name + '" --type "' + type + '"');
            t.show();
        }),
    );

    // Inline translation hints — shows translation value after trans('key')
    try {
        var transDecorationType = vscode.window.createTextEditorDecorationType({});

        function updateTransDecorations(editor) {
            if (!editor || editor.document.uri.scheme !== 'file') return;
            var doc = editor.document;
            // Derive root from document path or workspace
            var root = getProjectRoot();
            if (!root) {
                var p = doc.uri.fsPath;
                var idx = p.indexOf(path.sep + 'src' + path.sep);
                if (idx > 0) root = p.substring(0, idx);
            }
            if (!root) return;
            var decorations = [];

            // Load translations
            var trans = {};
            var modsDir = path.join(root, 'src', 'modules');
            if (fs.existsSync(modsDir)) {
                var mods = fs.readdirSync(modsDir);
                for (var m = 0; m < mods.length; m++) {
                    var td = path.join(modsDir, mods[m], 'translations');
                    if (fs.existsSync(td)) loadTransDir(td, td, trans);
                }
            }
            function loadTransDir(bd, cd, r) {
                var es; try { es = fs.readdirSync(cd); } catch(e) { return; }
                for (var i = 0; i < es.length; i++) {
                    var f = path.join(cd, es[i]);
                    var s; try { s = fs.statSync(f); } catch(e) { continue; }
                    if (s.isDirectory()) { loadTransDir(bd, f, r); }
                    else if (es[i].endsWith('.json')) {
                        var rel = path.relative(bd, path.dirname(f));
                        var pfx = rel ? rel.split(path.sep).join('.') : '';
                        var lang = es[i].replace('.json', '');
                        try { var d = JSON.parse(fs.readFileSync(f, 'utf-8')); flat(d, pfx, r, lang); } catch(e) {}
                    }
                }
            }
            function flat(d, pfx, r, lang) {
                for (var k in d) {
                    var key = pfx ? pfx + '.' + k : k;
                    if (typeof d[k] === 'object' && !Array.isArray(d[k])) { flat(d[k], key, r, lang); }
                    else if (typeof d[k] === 'string') { if (!r[key]) r[key] = {}; r[key][lang] = d[k]; }
                }
            }

            // Scan document for trans('key') patterns
            var text = doc.getText();
            var re = /trans\s*\(\s*['"]([^'"]+)['"]/g;
            var m;
            while ((m = re.exec(text)) !== null) {
                var key = m[1];
                var parts = doc.uri.fsPath.split(path.sep);
                var cIdx = parts.lastIndexOf('commands');
                var fk;
                if (key.startsWith('$')) fk = key.slice(1);
                else if (cIdx > 0) {
                    var cn = path.basename(doc.uri.fsPath, '.ts');
                    fk = 'command.' + cn + '.' + key;
                    var mn = parts[cIdx - 1];
                    var mk = 'command.' + mn + '.' + key;
                    if (!trans[fk] && trans[mk]) fk = mk;
                } else fk = key;

                if (trans[fk]) {
                    var enVal = trans[fk]['en'] || trans[fk][Object.keys(trans[fk])[0]] || '';
                    if (enVal) {
                        // Place decoration at end of line
                        var lineEnd = doc.lineAt(doc.positionAt(m.index).line).range.end;
                        decorations.push({
                            range: new vscode.Range(lineEnd, lineEnd),
                            renderOptions: {
                                after: {
                                    contentText: '// ' + enVal,
                                    color: new vscode.ThemeColor('textLink.foreground'),
                                    fontSize: '11px',
                                }
                            }
                        });
                    }
                }
            }
            if (decorations.length) {
                editor.setDecorations(transDecorationType, decorations);
            }
        }

        context.subscriptions.push(
            transDecorationType,
            vscode.window.onDidChangeActiveTextEditor(function(e) { if (e) updateTransDecorations(e); }),
            vscode.workspace.onDidChangeTextDocument(function(e) {
                var editor = vscode.window.activeTextEditor;
                if (editor && e.document === editor.document) updateTransDecorations(editor);
            })
        );
        setTimeout(function() {
            if (vscode.window.activeTextEditor) updateTransDecorations(vscode.window.activeTextEditor);
        }, 1000);
    } catch(e) {
        console.error('[Zumito] Decoration error:', e.message);
    }

    // "Edit translation" command — opens the translation JSON file at the correct line
    try {
        context.subscriptions.push(
            vscode.commands.registerCommand('zumito-cli.editTranslation', function() {
                var editor = vscode.window.activeTextEditor;
                if (!editor || editor.document.uri.scheme !== 'file') return;
                var root = getProjectRoot();
                if (!root) {
                    var p = editor.document.uri.fsPath;
                    var idx = p.indexOf(path.sep + 'src' + path.sep);
                    if (idx > 0) root = p.substring(0, idx);
                }
                if (!root) return;
                var doc = editor.document;
                var pos = editor.selection.active;
                var line = doc.lineAt(pos.line).text;
                var match = line.match(/trans\s*\(\s*['"]([^'"]+)['"]/);
                if (!match) {
                    vscode.window.showInformationMessage('No trans() call on this line.');
                    return;
                }
                var key = match[1];
                var parts = doc.uri.fsPath.split(path.sep);
                var cIdx = parts.lastIndexOf('commands');
                if (cIdx < 0) {
                    vscode.window.showInformationMessage('Not inside a commands folder.');
                    return;
                }
                var moduleName = parts[cIdx - 1];
                var cmdName = path.basename(doc.uri.fsPath, '.ts');

                var transDir = path.join(root, 'src', 'modules', moduleName, 'translations');
                if (!fs.existsSync(transDir)) {
                    vscode.window.showInformationMessage('No translations folder found for this module.');
                    return;
                }

                // Find all JSON files and search for the key
                var files = findTranslationFiles(transDir);
                var targetFile = null;
                var targetLine = 0;

                for (var i = 0; i < files.length; i++) {
                    try {
                        var content = fs.readFileSync(files[i], 'utf-8');
                        var lines = content.split('\n');
                        // Search for the key in the file content: "key": or "key" :
                        var keyPattern = new RegExp('"' + key + '"\\s*:');
                        for (var l = 0; l < lines.length; l++) {
                            if (keyPattern.test(lines[l])) {
                                targetFile = files[i];
                                targetLine = l; // 0-based
                                break;
                            }
                        }
                        if (targetFile) break;
                    } catch(e) {}
                }

                if (targetFile) {
                    // Open file and navigate to the line
                    var uri = vscode.Uri.file(targetFile);
                    vscode.workspace.openTextDocument(uri).then(function(doc) {
                        vscode.window.showTextDocument(doc, {
                            selection: new vscode.Range(targetLine, 0, targetLine, 0)
                        });
                    });
                } else {
                    vscode.window.showInformationMessage('Could not find the key in any translation file.');
                }
            })
        );

        // CodeActionProvider — shows lightbulb on lines with trans('key')
        context.subscriptions.push(
            vscode.languages.registerCodeActionsProvider('typescript', {
                provideCodeActions: function(doc, range) {
                    var line = doc.lineAt(range.start.line).text;
                    if (!/trans\s*\(\s*['"][^'"]+['"]/.test(line)) return [];
                    var action = new vscode.CodeAction('Edit translation', vscode.CodeActionKind.QuickFix);
                    action.command = { command: 'zumito-cli.editTranslation', title: 'Edit translation' };
                    return [action];
                }
            }, { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] })
        );

        function findTranslationFiles(dir) {
            var result = [];
            try {
                var entries = fs.readdirSync(dir);
                for (var i = 0; i < entries.length; i++) {
                    var full = path.join(dir, entries[i]);
                    var stat = fs.statSync(full);
                    if (stat.isDirectory()) result = result.concat(findTranslationFiles(full));
                    else if (entries[i].endsWith('.json')) result.push(full);
                }
            } catch(e) {}
            return result;
        }
    } catch(e) {
        console.error('[Zumito] Edit translation error:', e.message);
    }

    console.log('[Zumito] Extension activated');
}

function deactivate() {}

module.exports = { activate, deactivate };
