const vscode = require('vscode');
const path = require('path');
const { spawnSync } = require('child_process');
const fs = require('fs');
const { createWebview } = require('./modulesWebview.js');
const { openEmbedEditor } = require('./embedEditor.js');
const { parseConfig } = require('./configParser.js');
const { generateConfig } = require('./configGenerator.js');

function getProjectRoot() {
    return vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || null;
}

function cliPath() {
    const localPath = path.join(__dirname, '..', 'bin', 'index.js');
    if (fs.existsSync(localPath)) return localPath;
    return 'npx zumito-cli';
}

function runCliCmd(args) {
    const root = getProjectRoot();
    if (!root) return { status: 1 };
    const cli = cliPath();
    if (cli === 'npx zumito-cli') {
        return spawnSync('npx', ['zumito-cli', ...args], { cwd: root, encoding: 'utf-8' });
    }
    return spawnSync('node', [cli, ...args], { cwd: root, encoding: 'utf-8' });
}

function runCliJson(args) {
    try {
        const r = runCliCmd(typeof args === 'string' ? args.split(' ') : args);
        if (!r || r.status !== 0) return null;
        return JSON.parse(r.stdout);
    } catch { return null; }
}

function runCliSave(args) {
    try {
        runCliCmd(typeof args === 'string' ? args.split(' ') : args);
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

    const installCmd = vscode.commands.registerCommand('zumito-cli.modules.install', async (prefilledName) => {
        const root = getProjectRoot();
        if (!root) { vscode.window.showErrorMessage('Open a workspace first'); return; }
        const configPath = path.join(root, 'zumito.config.ts');
        if (!fs.existsSync(configPath)) { vscode.window.showErrorMessage('No zumito.config.ts found'); return; }

        const name = prefilledName || await vscode.window.showInputBox({ prompt: 'Module npm package name', placeHolder: '@zumito-team/analytics-module' });
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
                const cli = cliPath();
                const isNpx = cli === 'npx zumito-cli';
                const cmd = isNpx ? 'npx' : 'node';
                const cmdArgs = isNpx ? ['zumito-cli', ...args] : [cli, ...args];
                const r = spawnSync(cmd, cmdArgs, { cwd: targetDir, encoding: 'utf-8', stdio: 'inherit' });
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
            t.sendText('npx zumito-cli create module --name "' + name + '" --type "' + type + '"');
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
            t.sendText('npx zumito-cli create command --moduleName "' + moduleName + '" --name "' + name + '" --type "' + type + '"');
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
        console.error('[Zumito] Embed editor error:', e.message);
    }

    // Visual config editor
    try {
        context.subscriptions.push(
            vscode.commands.registerCommand('zumito-cli.editConfig', async function() {
                var doc;
                var editor = vscode.window.activeTextEditor;

                // Try to find zumito.config.ts in workspace
                var configUri;
                if (editor && editor.document.fileName.endsWith('zumito.config.ts')) {
                    doc = editor.document;
                } else {
                    var root = getProjectRoot();
                    if (!root) {
                        vscode.window.showErrorMessage('No workspace open');
                        return;
                    }
                    var configPath = path.join(root, 'zumito.config.ts');
                    if (!fs.existsSync(configPath)) {
                        vscode.window.showErrorMessage('zumito.config.ts not found in project root');
                        return;
                    }
                    configUri = vscode.Uri.file(configPath);
                    doc = await vscode.workspace.openTextDocument(configUri);
                    await vscode.window.showTextDocument(doc, { preview: false });
                }

                var source = doc.getText();
                var config = parseConfig(source);
                var panel = vscode.window.createWebviewPanel(
                    'zumitoConfigEditor',
                    'Config: zumito.config.ts',
                    vscode.ViewColumn.Beside,
                    { enableScripts: true, retainContextWhenHidden: true }
                );

                var htmlPath = path.join(__dirname, 'configEditor.html');
                var html = fs.readFileSync(htmlPath, 'utf8');
                panel.webview.html = html;

                panel.webview.onDidReceiveMessage(function(msg) {
                    if (msg.type === 'save') {
                        try {
                            var newSource = generateConfig(source, msg.config);
                            var fullRange = new vscode.Range(
                                doc.positionAt(0),
                                doc.positionAt(doc.getText().length)
                            );
                            var edit = new vscode.WorkspaceEdit();
                            edit.replace(doc.uri, fullRange, newSource);
                            vscode.workspace.applyEdit(edit).then(function() {
                                panel.webview.postMessage({ type: 'toast', text: 'Config saved!' });
                            });
                        } catch (e) {
                            vscode.window.showErrorMessage('Error saving config: ' + e.message);
                        }
                    } else if (msg.type === 'openModules') {
                        vscode.commands.executeCommand('zumito-cli.modules.configure');
                    }
                });

                // Send init data after webview is ready
                setTimeout(function() {
                    panel.webview.postMessage({ type: 'init', config: config });
                }, 300);
            })
        );
    } catch(e) {
        console.error('[Zumito] Config editor error:', e.message);
    }

    // Embed visual editor
    try {
        context.subscriptions.push(
            vscode.commands.registerCommand('zumito-cli.editEmbed', function() {
                openEmbedEditor(context);
            })
        );

        // CodeActionProvider — shows lightbulb on lines with EmbedBuilder
        context.subscriptions.push(
            vscode.languages.registerCodeActionsProvider('typescript', {
                provideCodeActions: function(doc, range) {
                    var line = doc.lineAt(range.start.line).text;
                    if (!/EmbedBuilder|\.setTitle|\.setDescription|\.addField/.test(line)) return [];
                    var action = new vscode.CodeAction('Edit embed visually', vscode.CodeActionKind.QuickFix);
                    action.command = { command: 'zumito-cli.editEmbed', title: 'Edit embed visually' };
                    return [action];
                }
            }, { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] })
        );
    } catch(e) {
        console.error('[Zumito] Embed editor error:', e.message);
    }

    // Discord Developer Portal
    try {
        context.subscriptions.push(
            vscode.commands.registerCommand('zumito-cli.discordPortal', function() {
                var root = getProjectRoot();
                var clientId = '';

                if (root) {
                    var envPath = path.join(root, '.env');
                    var envPathLocal = path.join(root, '.env.local');
                    var envFile = fs.existsSync(envPath) ? envPath : (fs.existsSync(envPathLocal) ? envPathLocal : null);
                    if (envFile) {
                        var envContent = fs.readFileSync(envFile, 'utf8');
                        var lines = envContent.split('\n');
                        for (var li = 0; li < lines.length; li++) {
                            var eq = lines[li].indexOf('=');
                            if (eq === -1) continue;
                            var key = lines[li].substring(0, eq).trim();
                            if (key === 'DISCORD_CLIENT_ID') {
                                clientId = lines[li].substring(eq + 1).trim();
                                break;
                            }
                        }
                    }
                }

                if (!clientId) {
                    vscode.window.showErrorMessage('DISCORD_CLIENT_ID not found in project .env' + (root ? ' at ' + root : ' (no workspace open)'));
                    return;
                }

                vscode.window.showQuickPick([
                    { label: 'Open Developer Portal', description: 'Open Discord Developer Portal in browser', value: 'portal' },
                    { label: 'Generate Invite URL', description: 'Copy bot invite URL with calculated permissions', value: 'invite' },
                    { label: 'Regenerate Token', description: 'Open the Bot page to reset token', value: 'token' },
                ], { placeHolder: 'Discord Developer Portal' }).then(function(opt) {
                    if (!opt) return;

                    if (opt.value === 'portal') {
                        vscode.env.openExternal(vscode.Uri.parse('https://discord.com/developers/applications/' + clientId));
                    } else if (opt.value === 'token') {
                        vscode.env.openExternal(vscode.Uri.parse('https://discord.com/developers/applications/' + clientId + '/bot'));
                    } else if (opt.value === 'invite') {
                        var PermissionFlagsBits = { SendMessages: 2048n, ReadMessageHistory: 65536n, ViewChannel: 1024n, EmbedLinks: 16384n, AddReactions: 64n, UseExternalEmojis: 262144n, Connect: 1048576n, Speak: 2097152n };
                        var basePerms = PermissionFlagsBits.SendMessages | PermissionFlagsBits.ReadMessageHistory | PermissionFlagsBits.ViewChannel | PermissionFlagsBits.EmbedLinks;

                        if (root) {
                            var cmdsDir = path.join(root, 'src', 'modules');
                            if (fs.existsSync(cmdsDir)) {
                                var entries = fs.readdirSync(cmdsDir, { withFileTypes: true });
                                for (var i = 0; i < entries.length; i++) {
                                    if (!entries[i].isDirectory()) continue;
                                    var cmdsFull = path.join(cmdsDir, entries[i].name, 'commands');
                                    if (!fs.existsSync(cmdsFull)) continue;
                                    var files = fs.readdirSync(cmdsFull, { withFileTypes: true });
                                    for (var j = 0; j < files.length; j++) {
                                        if (!files[j].isFile() || !files[j].name.endsWith('.ts')) continue;
                                        try {
                                            var content = fs.readFileSync(path.join(cmdsFull, files[j].name), 'utf8');
                                            var bpMatch = content.match(/botPermissions\s*[=:]\s*\[(.*?)\]/s);
                                            if (!bpMatch) continue;
                                            var str = bpMatch[1];
                                            var bits = str.match(/\d+n?/g);
                                            if (bits) bits.forEach(function(b) { basePerms |= BigInt(b.replace('n', '')); });
                                        } catch(e) {}
                                    }
                                }
                            }
                        }

                        var url = 'https://discord.com/oauth2/authorize?client_id=' + clientId + '&permissions=' + basePerms.toString() + '&scope=bot%20applications.commands';
                        vscode.env.clipboard.writeText(url);
                        vscode.window.showInformationMessage('Invite URL copied to clipboard!');
                    }
                });
            })
        );
    } catch(e) {
        console.error('[Zumito] Discord Portal error:', e.message);
    }

    console.log('[Zumito] Extension activated');
}

function deactivate() {}

module.exports = { activate, deactivate };
