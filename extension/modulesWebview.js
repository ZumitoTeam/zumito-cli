var vscode = require('vscode');
var path = require('path');
var fs = require('fs');
var cp = require('child_process');

function cliPath() { return path.join(__dirname, '..', 'bin', 'index.js'); }
function getRoot() { return vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || null; }

function runJson(args) {
  var root = getRoot();
  if (!root) return null;
  try {
    var r = cp.spawnSync('node', [cliPath()].concat(args.split(' ')), { cwd: root, encoding: 'utf-8' });
    return r.status === 0 ? JSON.parse(r.stdout) : null;
  } catch(e) { return null; }
}

function runSave(args) {
  var root = getRoot();
  if (!root) return;
  try { cp.spawnSync('node', [cliPath()].concat(args), { cwd: root, encoding: 'utf-8' }); } catch(e) {}
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ---------------------------------------------------------------------------
// Resolve npm package path
// ---------------------------------------------------------------------------
function resolvePackagePath(name) {
  var root = getRoot();
  if (!root) return null;
  if (fs.existsSync(path.join(root, 'node_modules', name))) return path.join(root, 'node_modules', name);
  if (fs.existsSync(path.join(root, 'node_modules', '@zumito-team', name))) return path.join(root, 'node_modules', '@zumito-team', name);
  var kebab = name.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();
  var candidates = [kebab, kebab.replace(/-module$/, ''), kebab + '-module', name.replace(/[Mm]odule$/, ''), name.toLowerCase()];
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i]; if (!c) continue;
    if (fs.existsSync(path.join(root, 'node_modules', c))) return path.join(root, 'node_modules', c);
    if (fs.existsSync(path.join(root, 'node_modules', '@zumito-team', c))) return path.join(root, 'node_modules', '@zumito-team', c);
  }
  try {
    var dd = path.join(root, 'node_modules', '@zumito-team');
    if (fs.existsSync(dd)) {
      var dirs = fs.readdirSync(dd);
      for (var i = 0; i < dirs.length; i++) {
        if (dirs[i].indexOf(name.toLowerCase().replace(/module$/i,'').replace(/[^a-z0-9-]/g,'')) > -1 || name.toLowerCase().indexOf(dirs[i].replace(/-module$/,'')) > -1) return path.join(dd, dirs[i]);
      }
    }
  } catch(e) {}
  return null;
}

// ---------------------------------------------------------------------------
// Schema detection
// ---------------------------------------------------------------------------
function discoverModuleSchema(moduleName) {
  var root = getRoot();
  if (!root) return null;
  try {
    var pkgPath = resolvePackagePath(moduleName);
    if (!pkgPath) return null;

    var cfgFiles = ['config.js','dist/config.js','config.ts','dist/config.ts'];
    for (var i = 0; i < cfgFiles.length; i++) {
      var f = path.join(pkgPath, cfgFiles[i]);
      if (fs.existsSync(f)) {
        var content = fs.readFileSync(f, 'utf-8');
        var keys = [], re = /static\s+(\w+)\s*=\s*(['"`]?)([^;]*)\2/g, m;
        while ((m = re.exec(content)) !== null) keys.push({ key: m[1], type: inferType(m[3].trim()) });
        if (keys.length) return keys;
      }
    }

    var dtsFiles = ['index.d.ts', 'dist/index.d.ts'];
    for (var i = 0; i < dtsFiles.length; i++) {
      var f = path.join(pkgPath, dtsFiles[i]);
      if (fs.existsSync(f)) {
        var content = fs.readFileSync(f, 'utf-8');
        var keys = [];
        var m1 = content.match(/createModuleEntry\s*<\s*\{([\s\S]*?)\}\s*>/);
        if (m1) { keys = parseTsProps(m1[1]); if (keys.length) return keys; }
        var m2 = content.match(/\(config\??\s*:\s*\{([\s\S]*?)\}\)\s*=>/);
        if (m2) { keys = parseTsProps(m2[1]); if (keys.length) return keys; }
        var m3 = content.match(/\(config\??\s*:\s*\{([\s\S]*?)\}\)/);
        if (m3) { keys = parseTsProps(m3[1]); if (keys.length) return keys; }
        var refs = content.match(/config\??\s*:\s*(\w+)/g);
        if (refs) {
          for (var r = 0; r < refs.length; r++) {
            var refName = refs[r].split(':')[1].trim();
            var ifaceRe = new RegExp('export\\s+interface\\s+' + refName + '\\s*\\{([\\s\\S]*?)\\}', 'g'), im;
            while ((im = ifaceRe.exec(content)) !== null) keys = keys.concat(parseTsProps(im[1]));
          }
        }
        if (keys.length) return keys;
      }
    }

    var tsFiles = ['index.ts', 'src/index.ts'];
    for (var i = 0; i < tsFiles.length; i++) {
      var f = path.join(pkgPath, tsFiles[i]);
      if (fs.existsSync(f)) {
        var content = fs.readFileSync(f, 'utf-8');
        var keys = [];
        var m1 = content.match(/createModuleEntry\s*<\s*\{([\s\S]*?)\}\s*>/);
        if (m1) { keys = parseTsProps(m1[1]); if (keys.length) return keys; }
        var m2 = content.match(/config\??\s*:\s*\{([\s\S]*?)\}/);
        if (m2) { keys = parseTsProps(m2[1]); if (keys.length) return keys; }
      }
    }
  } catch(e) {}
  return null;
}

function inferType(val) {
  if (val === 'true' || val === 'false') return 'boolean';
  if (!isNaN(Number(val))) return 'number';
  if (val.startsWith('[') || val.startsWith('{')) return 'json';
  return 'string';
}

function parseTsProps(str) {
  var keys = [], parts = str.split(/[;\n]/);
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].trim(); if (!p) continue;
    var m = p.match(/^\s*(\w+)\??\s*:\s*(\S+)/);
    if (m) {
      var raw = m[2].replace(/[\[\];]+/g, '').trim();
      var type = 'string';
      if (raw === 'boolean' || raw === 'Boolean') type = 'boolean';
      else if (raw === 'number' || raw === 'Number') type = 'number';
      else if (raw.startsWith('Array') || raw.indexOf('[]') > -1 || raw.startsWith('[')) type = 'array';
      else if (raw.startsWith('{')) type = 'object';
      else type = 'string';
      keys.push({ key: m[1], type: type });
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Single WebView panel: list view + config editor views
// ---------------------------------------------------------------------------
function createWebview(context) {
  var panel = vscode.window.createWebviewPanel(
    'zumitoModules', 'Zumito Modules',
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );
  var root = getRoot();
  if (!root) { panel.webview.html = '<body style="padding:20px">Open a workspace first.</body>'; return panel; }
  if (!fs.existsSync(path.join(root, 'zumito.config.ts'))) {
    panel.webview.html = '<body style="padding:20px">No zumito.config.ts found.</body>';
    return panel;
  }

  // Current state
  var currentView = 'list';
  var currentModule = null;

  panel.webview.html = listHtml();
  setTimeout(function() { panel.webview.postMessage({ type: 'modules', data: runJson('module list --json') || [] }); }, 500);

  function sendModules() {
    panel.webview.postMessage({ type: 'modules', data: runJson('module list --json') || [] });
  }

  panel.webview.onDidReceiveMessage(function(msg) {
    if (msg.type === 'showList') {
      currentView = 'list'; currentModule = null;
      panel.title = 'Zumito Modules';
      panel.webview.html = listHtml();
      setTimeout(function() { panel.webview.postMessage({ type: 'modules', data: runJson('module list --json') || [] }); }, 500);
      return;
    }
    if (msg.type === 'showConfig') {
      currentView = 'config'; currentModule = msg.name;
      panel.title = 'Config: ' + msg.name;
      var schema = discoverModuleSchema(msg.name);
      var modules = runJson('module list --json');
      var entry = modules ? modules.find(function(m) { return m.name === msg.name; }) : null;
      var cfg = (entry && entry.config) || {};
      var vars = (entry && entry.variables) || {};
      panel.webview.html = configHtml(msg.name, schema, cfg, vars);
      return;
    }
    if (msg.type === 'save') {
      runSave(['module', 'set-config', '--name', msg.name, '--config', JSON.stringify(msg.config)]);
      panel.webview.postMessage({ type: 'toast', text: 'Saved' });
      // Stay on config view but update dirty state
      return;
    }
    if (msg.type === 'install') {
      vscode.window.showInputBox({ prompt: 'Module npm package name', placeHolder: '@zumito-team/analytics-module' })
        .then(function(name) {
          if (!name) return;
          vscode.window.showQuickPick([
            { label: 'Add to config + npm install', value: 'install' },
            { label: 'Add to config only', value: 'config' }, { label: 'Cancel', value: 'cancel' }
          ], { placeHolder: name }).then(function(opt) {
            if (!opt || opt.value === 'cancel') return;
            runSave(['module', 'set-config', '--name', name, '--config', '{}']);
            if (opt.value === 'install') { var t = vscode.window.createTerminal({ name: 'Zumito' }); t.sendText('npm install ' + name); t.show(); }
            sendModules();
          });
        });
    }
    if (msg.type === 'remove') {
      vscode.window.showWarningMessage('Remove ' + msg.name + ' from config?', { modal: true }, 'Remove')
        .then(function(ok) { if (ok === 'Remove') { runSave(['module', 'remove', '--name', msg.name]); sendModules(); } });
    }
  });

  return panel;
}

// ---------------------------------------------------------------------------
// List HTML
// ---------------------------------------------------------------------------
function listHtml() {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
    '*{margin:0;padding:0;box-sizing:border-box}' +
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:16px;color:var(--vscode-editor-foreground);background:var(--vscode-editor-background);font-size:13px;user-select:none}' +
    'h1{font-size:18px;font-weight:600;margin-bottom:16px}' +
    'input{user-select:text}' +
    '.card{border:1px solid var(--vscode-panel-border);border-radius:8px;margin-bottom:10px;overflow:hidden}' +
    '.card-body{padding:14px;display:flex;justify-content:space-between;align-items:center;cursor:pointer}' +
    '.card-body:hover{background:var(--vscode-list-hoverBackground)}' +
    '.card-name{font-weight:600;font-size:14px}' +
    '.card-badge{font-size:11px;padding:2px 8px;border-radius:10px;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground)}' +
    '.card-actions{display:flex;gap:4px;padding:0 14px 10px}' +
    '.card-actions button{padding:4px 12px;border:none;border-radius:3px;cursor:pointer;font-size:12px}' +
    '.card-actions button.pri{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}' +
    '.card-actions button.dng{background:#c2342e;color:white}' +
    '.card-actions button.sec{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}' +
    '.empty{text-align:center;padding:40px;opacity:.6}.empty p{margin-bottom:12px}' +
    '.bar{margin-bottom:16px}' +
    'button.big{padding:8px 20px;border:none;border-radius:4px;cursor:pointer;font-size:13px;background:var(--vscode-button-background);color:var(--vscode-button-foreground)}' +
    'button.big:hover{background:var(--vscode-button-hoverBackground)}' +
  '</style></head><body>' +
  '<div class="bar"><button class="big" onclick="doIns()">+ Install Module</button></div>' +
  '<h1>Zumito Modules <span id="cnt" style="font-weight:400;opacity:.7"></span></h1>' +
  '<div id="list"></div>' +
  '<div id="empty" style="display:none" class="empty"><p>No external modules installed.</p></div>' +
  '<script>' +
  'var api=acquireVsCodeApi(),mods=[];' +
  'function doIns(){api.postMessage({type:"install"})}' +
  'function doRem(n){api.postMessage({type:"remove",name:n})}' +
  'function openM(n){api.postMessage({type:"showConfig",name:n})}' +
  'function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}' +
  'function render(d){' +
  ' mods=d||[];var c=document.getElementById("list"),e=document.getElementById("empty"),cnt=document.getElementById("cnt");' +
  ' if(!mods.length){c.innerHTML="";e.style.display="block";if(cnt)cnt.textContent="";return}' +
  ' e.style.display="none";if(cnt)cnt.textContent="("+mods.length+")";var h="";' +
  ' for(var i=0;i<mods.length;i++){' +
  '  var m=mods[i],badge=m.kind==="call"?"configured":"string";' +
  '  h+="<div class=\\"card\\"><div class=\\"card-body\\" onclick=\\"openM(\\\'"+esc(m.name)+"\\\')\\">";' +
  '  h+="<span class=\\"card-name\\">"+esc(m.name)+"</span><span class=\\"card-badge\\">"+badge+"</span>";' +
  '  h+="</div><div class=\\"card-actions\\">";' +
  '  h+="<button class=\\"sec\\" onclick=\\"event.stopPropagation();openM(\\\'"+esc(m.name)+"\\\')\\">Configure</button>";' +
  '  h+="<button class=\\"dng\\" onclick=\\"event.stopPropagation();doRem(\\\'"+esc(m.name)+"\\\')\\">Remove</button>";' +
  '  h+="</div></div>";' +
  ' }' +
  ' c.innerHTML=h' +
  '}' +
  'window.addEventListener("message",function(e){var m=e.data;if(m.type==="modules")render(m.data)});' +
  '</script></body></html>';
}

// ---------------------------------------------------------------------------
// Config HTML — uses the SAME panel, same onDidReceiveMessage
// ---------------------------------------------------------------------------
function configHtml(name, schema, cfg, variables) {
  var schemaKeys = schema || [];
  var keys = Object.keys(cfg);
  variables = variables || {};
  // Only show keys that are in the actual config, not all schema keys
  var all = [];
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k in variables) {
      all.push({ key: k, type: 'variable', varName: variables[k] });
    } else {
      var type = Array.isArray(cfg[k]) ? 'array' : typeof cfg[k];
      if (type === 'string' && /^[\[\{]/.test(cfg[k])) type = 'json';
      if (type === 'object') type = 'json';
      all.push({ key: k, type: type });
    }
  }

  var fieldsHtml = '';
  for (var i = 0; i < all.length; i++) {
    var k = all[i], val = cfg[k.key] !== undefined ? cfg[k.key] : '';
    fieldsHtml += renderFieldHtml(k, val, i);
  }

  // Build arrData as object keyed by field index (not sequential array)
  var arrData = {};
  for (var i = 0; i < all.length; i++) {
    if (all[i].type === 'array') {
      var val = cfg[all[i].key];
      arrData[i + ''] = { items: Array.isArray(val) ? val : [] };
    }
  }

  // Build schema dropdown options
  var addOpts = '';
  for (var i = 0; i < schemaKeys.length; i++) {
    var exists = cfg[schemaKeys[i].key] !== undefined ? ' ✓' : '';
    addOpts += '<option value="' + esc(schemaKeys[i].key) + '" data-type="' + esc(schemaKeys[i].type) + '">' + esc(schemaKeys[i].key) + ' (' + schemaKeys[i].type + ')' + exists + '</option>';
  }

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
    '*{margin:0;padding:0;box-sizing:border-box}' +
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:20px;color:var(--vscode-editor-foreground);background:var(--vscode-editor-background);font-size:13px}' +
    'input,select,button{font-family:inherit}input{user-select:text}' +
    'h1{font-size:18px;font-weight:600;margin-bottom:4px}' +
    '.sub{opacity:.6;font-size:12px;margin-bottom:20px}' +
    '.row{display:flex;align-items:flex-start;padding:6px 0;gap:12px}' +
    '.lbl{min-width:200px;font-size:13px;display:flex;align-items:center;gap:4px;padding-top:4px}' +
    '.inp{flex:1;display:flex}' +
    '.tbadge{font-size:10px;padding:1px 6px;border-radius:4px;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);white-space:nowrap}' +
    '.tinp{flex:1;padding:4px 8px;border:1px solid var(--vscode-input-border);background:var(--vscode-input-background);color:var(--vscode-input-foreground);border-radius:3px;font-size:13px}' +
    '.ninp{width:140px;padding:4px 8px;border:1px solid var(--vscode-input-border);background:var(--vscode-input-background);color:var(--vscode-input-foreground);border-radius:3px;font-size:13px}' +
    '.cbl{cursor:pointer;display:flex;align-items:center;gap:6px}' +
    '.cbl input[type="checkbox"]{width:18px;height:18px;cursor:pointer}' +
    '.awrap{display:flex;flex-direction:column;gap:4px;width:100%}' +
    '.aitem{display:flex;align-items:center;gap:6px;padding:3px 8px;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);border-radius:4px;font-size:12px;max-width:300px;word-break:break-all}' +
    '.aitem span{flex:1}' +
    '.arem{background:none;border:none;cursor:pointer;font-size:16px;color:var(--vscode-errorForeground);padding:0 2px}' +
    '.aadd{display:flex;gap:4px;margin-top:2px}' +
    '.aadd input{flex:1;padding:3px 6px;border:1px solid var(--vscode-input-border);background:var(--vscode-input-background);color:var(--vscode-input-foreground);border-radius:3px;font-size:12px}' +
    '.bar{display:flex;gap:8px;margin-top:20px;padding-top:16px;border-top:1px solid var(--vscode-panel-border)}' +
    'button{padding:8px 20px;border:none;border-radius:3px;cursor:pointer;font-size:13px}' +
    'button.pri{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}' +
    'button.pri:hover{background:var(--vscode-button-hoverBackground)}' +
    'button.sec{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}' +
    '.toast{position:fixed;bottom:16px;right:16px;padding:8px 16px;border-radius:4px;background:var(--vscode-notifications-background);border:1px solid var(--vscode-notifications-border);display:none;z-index:999}' +
    '.toast.show{display:block}' +
  '</style></head><body>' +
  '<div class="bar" style="border:none;padding:0;margin-bottom:12px"><button class="sec" onclick="goBack()">← Back</button></div>' +
  '<h1>' + esc(name) + '</h1><div class="sub">Module configuration' +
  (schemaKeys.length ? '' : ' <span style="opacity:.5;font-style:italic">(no schema detected)</span>') +
  '</div>' +
  '<div id="flds">' + fieldsHtml + '</div>' +
  (schemaKeys.length > 0
    ? '<div style="margin-top:12px"><div class="sec">Add key</div><div class="add-row"><select id="sk"><option value="">— select —</option>' + addOpts + '</select><button class="pri" onclick="addSchema()">Add</button></div></div>'
    : '') +
  '<div class="bar"><button class="pri" id="saveBtn" onclick="doSave()">Save</button><span id="dirtyInd" style="display:none;color:var(--vscode-errorForeground);font-size:12px;padding:8px 0">unsaved</span></div>' +
  '<div id="toast" class="toast"></div>' +
  '<script>' +
  'var api=acquireVsCodeApi(),_dirty=false,arrData=' + JSON.stringify(arrData) + ';' +
  'function goBack(){api.postMessage({type:"showList"})}' +
  'function dirty(){if(!_dirty){_dirty=true;var e=document.getElementById("dirtyInd");if(e)e.style.display="inline";var b=document.getElementById("saveBtn");if(b)b.textContent="Save *"}}' +
  'function collect(){var c={};' +
  ' var rows=document.getElementById("flds").querySelectorAll(".row");' +
  ' rows.forEach(function(r,i){' +
  '   var lb=r.querySelector(".lbl span");if(!lb)return;var key=lb.textContent;' +
  '   var badge=r.querySelector(".tbadge");var type=badge?badge.getAttribute("data-type"):"string";' +
  '   var inp=r.querySelector("input");' +
  '   if(type==="array"){c[key]=arrData[i]?arrData[i].items:[];return}' +
  '   if(!inp)return;' +
  '   if(inp.type==="checkbox")c[key]=inp.checked;' +
  '   else if(inp.type==="number")c[key]=parseFloat(inp.value)||0;' +
  '   else c[key]=inp.value;' +
  ' });return c' +
  '}' +
  'function doSave(){' +
  ' api.postMessage({type:"save",name:"' + esc(name) + '",config:collect()});' +
  ' _dirty=false;var e=document.getElementById("dirtyInd");if(e)e.style.display="none";var b=document.getElementById("saveBtn");if(b)b.textContent="Save"' +
  '}' +
  'function addSchema(){' +
  ' var sel=document.getElementById("sk");if(!sel||!sel.value)return;' +
  ' var key=sel.value,type=sel.options[sel.selectedIndex].getAttribute("data-type")||"string";' +
  ' var fields=document.getElementById("flds");if(!fields)return;' +
  ' var i=fields.children.length;' +
  ' var b="<span class=\\"tbadge\\" data-type=\\"\'+type+\'\\">"+esc(type)+"</span>";' +
  ' var inp;' +
  ' if(type==="boolean")inp="<label class=\\"cbl\\"><input type=\\"checkbox\\" id=\\"f"+i+"\\" onchange=\\"dirty()\\"><span>false</span></label>";' +
  ' else if(type==="number")inp="<input type=\\"number\\" id=\\"f"+i+"\\" oninput=\\"dirty()\\" class=\\"ninp\\">";' +
  ' else if(type==="array"){inp="<div class=\\"awrap\\" id=\\"aw"+i+"\\"><div class=\\"aadd\\"><input type=\\"text\\" class=\\"aval\\" placeholder=\\"add item\\"><button class=\\"pri\\" onclick=\\"arrAdd("+i+")\\">+</button></div></div>";arrData[i]={items:[]}}' +
  ' else inp="<input type=\\"text\\" id=\\"f"+i+"\\" oninput=\\"dirty()\\" class=\\"tinp\\">";' +
  ' var d=document.createElement("div");d.className="row";' +
  ' d.innerHTML="<div class=\\"lbl\\"><span>"+esc(key)+"</span>"+b+"</div><div class=\\"inp\\">"+inp+"</div>";' +
  ' fields.appendChild(d);sel.value="";dirty()' +
  '}' +
  'function arrAdd(i){' +
  ' var w=document.getElementById("aw"+i);if(!w)return;var ip=w.querySelector(".aval");if(!ip||!ip.value.trim())return;' +
  ' var item=ip.value.trim();' +
  ' var idx=arrData[i]?arrData[i].items.length:0;' +
  ' var d=document.createElement("div");d.className="aitem";' +
  ' var btn=document.createElement("button");btn.className="arem";btn.textContent="\\u00D7";' +
  ' (function(fi,fi2){btn.onclick=function(){arrRemove(fi,fi2)}})(i,idx);' +
  ' d.appendChild(document.createTextNode(item));d.appendChild(btn);' +
  ' w.insertBefore(d,w.querySelector(".aadd"));if(!arrData[i])arrData[i]={items:[]};arrData[i].items.push(item);ip.value="";dirty()' +
  '}' +
  'function arrRemove(i,idx){if(!arrData[i])return;arrData[i].items.splice(idx,1);var w=document.getElementById("aw"+i);if(!w)return;var its=w.querySelectorAll(".aitem");if(its[idx])its[idx].remove();dirty()}' +
  'function arrRm(id,i,idx){document.getElementById(id).remove();if(!arrData[i])return;arrData[i].items.splice(idx,1);dirty()}' +
  'function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}' +
  'document.addEventListener("keydown",function(e){if((e.key==="a"||e.key==="A")&&(e.metaKey||e.ctrlKey)&&e.target.tagName!=="INPUT"&&e.target.tagName!=="TEXTAREA"&&e.target.tagName!=="SELECT")e.preventDefault()});' +
  'window.addEventListener("message",function(e){var m=e.data;if(m.type==="toast"){var t=document.getElementById("toast");t.textContent=m.text;t.classList.add("show");setTimeout(function(){t.classList.remove("show")},2500)}});' +
  '</script></body></html>';
}

function renderFieldHtml(k, val, i) {
  var inp = '';
  var id = 'f' + i;

  if (k.type === 'variable') {
    var badge = '<span class="tbadge" data-type="variable" style="background:var(--vscode-inputValidation-warningBackground);color:var(--vscode-inputValidation-warningForeground)">variable</span>';
    inp = '<div style="padding:4px 8px;opacity:.7;font-style:italic;font-size:12px;display:flex;align-items:center;gap:6px"><span class="codicon codicon-symbol-variable"></span> ' + esc(k.varName) + ' <span style="font-size:11px;opacity:.5">(read-only, defined elsewhere)</span></div>';
    return '<div class="row"><div class="lbl"><span>' + esc(k.key) + '</span>' + badge + '</div><div class="inp">' + inp + '</div></div>';
  }

  var badge = '<span class="tbadge" data-type="' + k.type + '">' + esc(k.type) + '</span>';
  if (k.type === 'boolean') {
    var ch = (val === true || val === 'true') ? 'checked' : '';
    inp = '<label class="cbl"><input type="checkbox" id="' + id + '" ' + ch + ' onchange="dirty()"><span class="cbspan">' + (ch ? 'true' : 'false') + '</span></label>';
  } else if (k.type === 'number') {
    inp = '<input type="number" id="' + id + '" value="' + esc(String(val != null ? val : '')) + '" oninput="dirty()" class="ninp">';
  } else if (k.type === 'array') {
    var items = Array.isArray(val) ? val : [];
    var itemsHtml = items.map(function(item, idx) {
      return '<div class="aitem" id="ai' + i + '_' + idx + '"><span>' + esc(String(item)) + '</span><button class="arem" onclick="arrRm(\'ai' + i + '_' + idx + '\',' + i + ',' + idx + ')">&times;</button></div>';
    }).join('');
    inp = '<div class="awrap" id="aw' + i + '">' + itemsHtml + '<div class="aadd"><input type="text" class="aval" placeholder="add item"><button class="pri" onclick="arrAdd(' + i + ')">+</button></div></div>';
  } else {
    inp = '<input type="text" id="' + id + '" value="' + esc(String(val != null ? val : '')) + '" oninput="dirty()" class="tinp">';
  }
  return '<div class="row"><div class="lbl"><span>' + esc(k.key) + '</span>' + badge + '</div><div class="inp">' + inp + '</div></div>';
}

module.exports = { createWebview };
