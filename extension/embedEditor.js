var vscode = require('vscode');
var path = require('path');
var fs = require('fs');

// Load translation JSON files for the module containing the given file path
function loadTranslations(filePath) {
  var trans = {};
  var parts = filePath.split(path.sep);
  var srcIdx = -1;
  for (var i = 0; i < parts.length; i++) {
    if (parts[i] === 'src' && parts[i + 1] === 'modules') { srcIdx = i; break; }
  }
  if (srcIdx === -1) return trans;
  var projectRoot = parts.slice(0, srcIdx).join(path.sep);
  var transDir = path.join(projectRoot, 'src', 'modules', parts[srcIdx + 2], 'translations');
  if (!fs.existsSync(transDir)) return trans;
  function walk(dir) {
    try {
      var entries = fs.readdirSync(dir, { withFileTypes: true });
      for (var e = 0; e < entries.length; e++) {
        var ep = path.join(dir, entries[e].name);
        if (entries[e].isDirectory()) walk(ep);
        else if (entries[e].name.endsWith('.json')) {
          try { Object.assign(trans, JSON.parse(fs.readFileSync(ep, 'utf-8'))); }
          catch (x) { /* skip invalid JSON */ }
        }
      }
    } catch (x) { /* skip unreadable */ }
  }
  walk(transDir);
  return trans;
}

// ============================================================
// Parser — extracts embed data from TypeScript source
// ============================================================
function parseEmbed(source) {
  var result = {
    title: { value: '', raw: '', type: 'literal' },
    description: { value: '', raw: '', type: 'literal' },
    color: { value: 0x5865F2, raw: '', type: 'literal' },
    url: { value: '', raw: '', type: 'literal' },
    timestamp: { value: '', raw: '', type: 'literal' },
    footer: { text: { value: '', raw: '', type: 'literal' }, iconURL: { value: '', raw: '', type: 'literal' } },
    image: { url: { value: '', raw: '', type: 'literal' } },
    thumbnail: { url: { value: '', raw: '', type: 'literal' } },
    author: { name: { value: '', raw: '', type: 'literal' }, iconURL: { value: '', raw: '', type: 'literal' }, url: { value: '', raw: '', type: 'literal' } },
    fields: [],
    fieldsRaw: '',
    hasFields: false,
  };

  // Extract setTitle('...') or setTitle(trans('...')) or setTitle(var)
  result.title = extractCallArg(source, 'setTitle');
  result.description = extractCallArg(source, 'setDescription');
  result.url = extractCallArg(source, 'setURL');
  result.color = extractColor(source);
  result.timestamp = extractCallArg(source, 'setTimestamp');

  // Footer
  var footerMatch = source.match(/\.setFooter\s*\(\s*\{([^}]+)\}\s*\)/);
  if (footerMatch) {
    var footerBlock = footerMatch[1];
    result.footer.text = extractObjProp(footerBlock, 'text');
    result.footer.iconURL = extractObjProp(footerBlock, 'iconURL');
  }

  // Author
  var authorMatch = source.match(/\.setAuthor\s*\(\s*\{([^}]+)\}\s*\)/);
  if (authorMatch) {
    var authorBlock = authorMatch[1];
    result.author.name = extractObjProp(authorBlock, 'name');
    result.author.iconURL = extractObjProp(authorBlock, 'iconURL');
    result.author.url = extractObjProp(authorBlock, 'url');
  }

  // Image & Thumbnail
  var imgMatch = source.match(/\.setImage\s*\(\s*\{([^}]+)\}\s*\)/);
  if (imgMatch) result.image.url = extractObjProp(imgMatch[1], 'url');
  var thumbMatch = source.match(/\.setThumbnail\s*\(\s*\{([^}]+)\}\s*\)/);
  if (thumbMatch) result.thumbnail.url = extractObjProp(thumbMatch[1], 'url');

  // Fields — find addFields([...])
  var fieldsMatch = source.match(/\.addFields?\s*\(/);
  if (fieldsMatch) {
    var start = fieldsMatch.index + fieldsMatch[0].length;
    var rest = source.substring(start);
    var depth = 0;
    var end = 0;
    for (var i = 0; i < rest.length; i++) {
      if (rest[i] === '(') depth++;
      else if (rest[i] === ')') {
        if (depth === 0) { end = i; break; }
        depth--;
      } else if (rest[i] === '[') {
        // Array starts here
        var arrDepth = 0;
        for (var j = i; j < rest.length; j++) {
          if (rest[j] === '[') arrDepth++;
          else if (rest[j] === ']') { arrDepth--; if (arrDepth === 0) { end = j + 1; break; } }
        }
        if (end) break;
      }
    }
    if (end) {
      var fieldsContent = rest.substring(0, end);
      result.hasFields = true;
      result.fieldsRaw = '.addFields(' + fieldsContent + ')';
      result.fields = parseFieldsArray(fieldsContent);
    }
  }

  return result;
}

function extractCallArg(source, method) {
  var re = new RegExp('\\.' + method + '\\s*\\((.*)\\)\\s*(\\.|$)');
  var m = source.match(re);
  if (!m) return { value: '', raw: '', type: 'literal' };
  var arg = m[1];
  // Find the matching closing paren, skipping string literals
  var depth = 0, inStr = null;
  for (var i = 0; i < arg.length; i++) {
    if (inStr) {
      if (arg[i] === '\\') { i++; continue; }
      if (arg[i] === inStr) inStr = null;
      continue;
    }
    if (arg[i] === "'" || arg[i] === '"' || arg[i] === '`') { inStr = arg[i]; continue; }
    if (arg[i] === '(') depth++;
    else if (arg[i] === ')') {
      if (depth === 0) { arg = arg.substring(0, i); break; }
      depth--;
    }
  }
  return parseArg(arg.trim());
}

function extractColor(source) {
  var m = source.match(/\.setColor\s*\(\s*(0x[0-9a-fA-F]+|'#[0-9a-fA-F]+'|"#[0-9a-fA-F]+")\s*\)/);
  if (m) {
    var raw = m[1];
    var val;
    if (raw.startsWith('0x')) val = parseInt(raw, 16);
    else val = parseInt(raw.replace(/['"]/g, '#').replace('#', ''), 16);
    return { value: val || 0x5865F2, raw: raw, type: 'literal' };
  }
  return { value: 0x5865F2, raw: '', type: 'literal' };
}

function extractObjProp(block, prop) {
  var re = new RegExp(prop + '\\s*:\\s*([^,\\n}]+)');
  var m = block.match(re);
  if (!m) return { value: '', raw: '', type: 'literal' };
  return parseArg(m[1].trim());
}

function parseArg(arg) {
  // String literal: '...' or "..."
  var strM = arg.match(/^['"]([^'"]*)['"]$/);
  if (strM) return { value: strM[1], raw: arg, type: 'literal' };

  // Hex number: 0x...
  var hexM = arg.match(/^(0x[0-9a-fA-F]+)$/);
  if (hexM) return { value: parseInt(hexM[1], 16), raw: arg, type: 'literal' };

  // Number
  var numM = arg.match(/^(\d+)$/);
  if (numM) return { value: parseInt(numM[1], 10), raw: arg, type: 'literal' };

  // Boolean
  if (arg === 'true') return { value: true, raw: arg, type: 'literal' };
  if (arg === 'false') return { value: false, raw: arg, type: 'literal' };

  // Variable or trans() call
  var transM = arg.match(/^trans\s*\(\s*['"]([^'"]+)['"]\s*\)$/);
  if (transM) return { value: transM[1], raw: arg, type: 'trans' };

  // Generic variable
  return { value: arg, raw: arg, type: 'variable' };
}

function parseFieldsArray(arrSource) {
  var fields = [];
  // Split by object boundaries: { ... }, { ... }
  var re = /\{([^}]+)\}/g;
  var m;
  while ((m = re.exec(arrSource)) !== null) {
    var block = m[1];
    var name = extractObjProp(block, 'name');
    var value = extractObjProp(block, 'value');
    var inline = extractObjProp(block, 'inline');
    fields.push({
      name: name,
      value: value,
      inline: { value: inline.value === true || inline.value === 'true', raw: inline.raw, type: 'literal' },
    });
  }
  return fields;
}

// ============================================================
// Generator — writes embed data back into TypeScript source
// ============================================================
function generateEmbed(source, data) {
  var result = source;

  result = replaceCallArg(result, 'setTitle', data.title);
  result = replaceCallArg(result, 'setDescription', data.description);
  result = replaceCallArg(result, 'setURL', data.url);
  result = replaceColor(result, data.color);
  result = replaceCallArg(result, 'setTimestamp', data.timestamp);
  result = replaceFooter(result, data.footer);
  result = replaceAuthor(result, data.author);
  result = replaceObjArg(result, 'setImage', data.image);
  result = replaceObjArg(result, 'setThumbnail', data.thumbnail);
  result = replaceFields(result, data.fields);

  return result;
}

function replaceCallArg(source, method, argData) {
  if (!argData || argData.type !== 'literal') return source;
  var escaped = argData.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp('(\\.' + method + '\\s*\\(\\s*)[^)]+(\\s*\\))');
  return source.replace(re, '$1' + JSON.stringify(argData.value) + '$2');
}

function replaceColor(source, colorData) {
  if (!colorData || colorData.type !== 'literal') return source;
  var hex = '0x' + colorData.value.toString(16).padStart(6, '0');
  var re = /\.setColor\s*\(\s*[^)]+\s*\)/;
  return source.replace(re, '.setColor(' + hex + ')');
}

function replaceFooter(source, footer) {
  if (!footer) return source;
  var re = /\.setFooter\s*\(\s*\{[^}]*\}\s*\)/;
  var parts = [];
  if (footer.text.type === 'literal') parts.push('text: ' + JSON.stringify(footer.text.value));
  if (footer.iconURL.type === 'literal') parts.push('iconURL: ' + JSON.stringify(footer.iconURL.value));
  if (parts.length) return source.replace(re, '.setFooter({ ' + parts.join(', ') + ' })');
  return source;
}

function replaceAuthor(source, author) {
  if (!author) return source;
  var re = /\.setAuthor\s*\(\s*\{[^}]*\}\s*\)/;
  var parts = [];
  if (author.name.type === 'literal') parts.push('name: ' + JSON.stringify(author.name.value));
  if (author.iconURL.type === 'literal') parts.push('iconURL: ' + JSON.stringify(author.iconURL.value));
  if (author.url.type === 'literal') parts.push('url: ' + JSON.stringify(author.url.value));
  if (parts.length) return source.replace(re, '.setAuthor({ ' + parts.join(', ') + ' })');
  return source;
}

function replaceObjArg(source, method, obj) {
  if (!obj || obj.url.type !== 'literal') return source;
  var re = new RegExp('\\.' + method + '\\s*\\(\\s*\\{[^}]*\\}\\s*\\)');
  return source.replace(re, '.' + method + '({ url: ' + JSON.stringify(obj.url.value) + ' })');
}

function replaceFields(source, fields) {
  if (!fields || !fields.length) return source;
  var re = /\.addFields?\s*\(\s*\[[\s\S]*?\]\s*\)/;
  var fieldStr = fields.map(function(f) {
    var parts = [];
    if (f.name.type === 'literal') parts.push('name: ' + JSON.stringify(f.name.value));
    if (f.value.type === 'literal') parts.push('value: ' + JSON.stringify(f.value.value));
    if (f.inline.type === 'literal') parts.push('inline: ' + (f.inline.value ? 'true' : 'false'));
    return '{ ' + parts.join(', ') + ' }';
  }).join(',\n      ');
  return source.replace(re, '.addFields([\n      ' + fieldStr + '\n    ])');
}

// ============================================================
// WebView — editor + preview
// ============================================================
function openEmbedEditor(context) {
  var editor = vscode.window.activeTextEditor;
  if (!editor) { vscode.window.showErrorMessage('Open a file first'); return; }
  var doc = editor.document;
  var source = doc.getText();
  var data = parseEmbed(source);
  var fileName = path.basename(doc.uri.fsPath);

  var trans = loadTranslations(doc.uri.fsPath);
  var panel = vscode.window.createWebviewPanel(
    'zumitoEmbedEditor', 'Embed: ' + fileName,
    vscode.ViewColumn.Beside,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  panel.webview.html = getEmbedHtml(data, trans);
  var lastSource = source;

  panel.webview.onDidReceiveMessage(function(msg) {
    if (msg.type === 'save') {
      try {
        var newSource = generateEmbed(lastSource, msg.data);
        var fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
        var edit = new vscode.WorkspaceEdit();
        edit.replace(doc.uri, fullRange, newSource);
        vscode.workspace.applyEdit(edit).then(function() {
          lastSource = doc.getText();
          panel.webview.postMessage({ type: 'toast', text: 'Saved' });
        });
      } catch(e) { panel.webview.postMessage({ type: 'toast', text: 'Error: ' + e.message }); }
    } else if (msg.type === 'pickTrans') {
      var keys = Object.keys(trans).sort();
      vscode.window.showQuickPick(keys, { placeHolder: 'Translation key for ' + msg.key })
        .then(function(picked) {
          if (picked) {
            panel.webview.postMessage({ type: 'transPicked', key: picked, resolved: trans[picked] || picked, id: msg.id });
          }
        });
    }
  });
}

function sampleData(trans) {
  return {
    title: { value: 'Embed Title', raw: '', type: 'literal' },
    description: { value: 'Description text here', raw: '', type: 'literal' },
    color: { value: 0x5865F2, raw: '0x5865F2', type: 'literal' },
    url: { value: 'https://example.com', raw: '', type: 'literal' },
    timestamp: { value: '', raw: '', type: 'literal' },
    footer: { text: { value: 'Footer text', raw: '', type: 'literal' }, iconURL: { value: '', raw: '', type: 'literal' } },
    image: { url: { value: '', raw: '', type: 'literal' } },
    thumbnail: { url: { value: '', raw: '', type: 'literal' } },
    author: { name: { value: 'Author Name', raw: '', type: 'literal' }, iconURL: { value: '', raw: '', type: 'literal' }, url: { value: '', raw: '', type: 'literal' } },
    fields: [
      { name: { value: 'Field 1', raw: '', type: 'literal' }, value: { value: 'Value 1', raw: '', type: 'literal' }, inline: { value: true, raw: 'true', type: 'literal' } },
      { name: { value: 'Field 2', raw: '', type: 'literal' }, value: { value: 'Value 2', raw: '', type: 'literal' }, inline: { value: true, raw: 'true', type: 'literal' } },
    ],
    hasFields: true,
    fieldsRaw: '',
  };
}

// Resolve a field value: trans → translation lookup, variable → raw code, literal → value
function resolveField(f, trans) {
  if (!f || !f.type) return '';
  if (f.type === 'trans') return trans[f.value] || f.value;
  if (f.type === 'variable') return f.raw || f.value || '';
  return f.value || '';
}


function getEmbedHtml(data, trans) {
  var hasData = data.title.value || data.description.value || data.fields.length;
  if (!hasData) data = sampleData(trans);

  function resolveField(f) {
    if (!f || !f.type) return '';
    if (f.type === 'trans') return trans[f.value] || f.value;
    if (f.type === 'variable') return f.raw || f.value || '';
    return f.value || '';
  }

  // Build simple embed data structure for the webview
  var ed = {
    title: { v: data.title.value, r: data.title.raw || data.title.value, t: data.title.type, x: resolveField(data.title) },
    desc: { v: data.description.value, r: data.description.raw || data.description.value, t: data.description.type, x: resolveField(data.description) },
    url: { v: data.url.value, r: data.url.raw || data.url.value, t: data.url.type, x: resolveField(data.url) },
    color: { v: data.color.raw || '#5865F2', r: data.color.raw || '#5865F2', t: 'literal', x: data.color.raw || '#5865F2' },
    authorName: { v: data.author.name.value, r: data.author.name.raw || data.author.name.value, t: data.author.name.type, x: resolveField(data.author.name) },
    authorIcon: { v: data.author.iconURL.value, r: data.author.iconURL.raw || data.author.iconURL.value, t: data.author.iconURL.type, x: resolveField(data.author.iconURL) },
    footerText: { v: data.footer.text.value, r: data.footer.text.raw || data.footer.text.value, t: data.footer.text.type, x: resolveField(data.footer.text) },
    footerIcon: { v: data.footer.iconURL.value, r: data.footer.iconURL.raw || data.footer.iconURL.value, t: data.footer.iconURL.type, x: resolveField(data.footer.iconURL) },
    imageUrl: { v: data.image.url.value, r: data.image.url.raw || data.image.url.value, t: data.image.url.type, x: resolveField(data.image.url) },
    thumbUrl: { v: data.thumbnail.url.value, r: data.thumbnail.url.raw || data.thumbnail.url.value, t: data.thumbnail.url.type, x: resolveField(data.thumbnail.url) },
  };

  var edJson = JSON.stringify(ed);
  var fieldsJson = JSON.stringify((data.fields || []).map(function(f) {
    return {
      n: { v: f.name.value, r: f.name.raw || f.name.value, t: f.name.type, x: resolveField(f.name) },
      v: { v: f.value.value, r: f.value.raw || f.value.value, t: f.value.type, x: resolveField(f.value) },
      i: { v: f.inline.value, r: f.inline.raw || String(f.inline.value), t: f.inline.type, x: f.inline.value },
    };
  }));

  // Render a value: literal=input, trans=clickable tag, variable=editable with badge
  var keysMap = JSON.stringify(['title','desc','url','color','authorName','authorIcon','footerText','footerIcon','imageUrl','thumbUrl']);

  function rf(field, id) {
    if (field.type === 'trans') {
      return '<div class="tag trans-tag" data-id="'+id+'"><span class="tk">trans(\'' + esc(field.value) + '\')</span><span class="ta">\u2192</span><span class="tr">' + esc(resolveField(field)) + '</span></div>';
    }
    if (field.type === 'variable') {
      return '<div class="var-wrap"><span class="vlb">var</span><input class="vv" id="i'+id+'" value="' + esc(field.value || field.raw || '') + '"></div>';
    }
    if (id === 1) return '<textarea id="i1" rows="3">' + esc(field.value) + '</textarea>';
    return '<input id="i'+id+'" value="' + esc(field.value) + '">';
  }

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
    '*{margin:0;padding:0;box-sizing:border-box}' +
    'body{padding:16px;color:var(--vscode-editor-foreground);background:var(--vscode-editor-background);font-size:13px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}' +
    '.cols{display:flex;gap:20px;align-items:flex-start}' +
    '.left{flex:0 0 380px}' +
    '.right{flex:1;position:sticky;top:16px}' +
    'label{display:block;font-size:11px;opacity:.7;margin-top:8px;margin-bottom:2px}' +
    'input,textarea{width:100%;padding:5px 8px;border:1px solid var(--vscode-input-border);background:var(--vscode-input-background);color:var(--vscode-input-foreground);border-radius:3px;font-size:13px;font-family:inherit}' +
    'input:focus,textarea:focus{outline:1px solid var(--vscode-focusBorder)}' +
    'textarea{resize:vertical;min-height:60px}' +
    '.sec{font-weight:600;margin:14px 0 4px;padding-bottom:2px;border-bottom:1px solid var(--vscode-panel-border)}' +
    '.tag{display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:4px;font-size:13px;width:100%;min-height:30px}' +
    '.trans-tag{background:var(--vscode-editorInfo-background,#1a3a5c);border:1px solid var(--vscode-editorInfo-border,#3794ff);cursor:pointer}' +
    '.trans-tag:hover{border-color:var(--vscode-textLink-activeForeground,#6cb6ff)}' +
    '.tk{font-family:monospace;color:var(--vscode-textLink-foreground,#3794ff);font-size:12px}' +
    '.ta{opacity:.5;font-size:11px}' +
    '.tr{color:var(--vscode-editor-foreground);font-size:13px}' +
    '.var-wrap{display:flex;align-items:center;gap:0;width:100%;border:1px solid var(--vscode-editorWarning-border,#b89500);border-radius:4px;overflow:hidden}' +
    '.var-wrap .vlb{font-size:10px;font-weight:700;text-transform:uppercase;background:rgba(0,0,0,.2);padding:5px 6px;color:var(--vscode-editorWarning-foreground,#c8a000);white-space:nowrap}' +
    '.var-wrap .vv{flex:1;border:none!important;border-radius:0!important;background:var(--vscode-editorWarning-background,#3a2a00)!important}' +
    '.var-wrap .vv:focus{outline:none!important}' +
    '.frow{display:flex;gap:4px;align-items:center;margin-bottom:4px}' +
    '.frow input{flex:1}.frow .fn{width:30%}.frow .fv{width:35%}' +
    '.frow label{display:flex;align-items:center;gap:2px;white-space:nowrap;font-size:11px;margin:0}' +
    '.frow label input{width:14px;height:14px}' +
    'button{padding:5px 12px;border:none;border-radius:3px;cursor:pointer;font-size:12px}' +
    'button.pri{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}' +
    'button.pri:hover{background:var(--vscode-button-hoverBackground)}' +
    'button.rm{background:none;color:var(--vscode-errorForeground);font-size:18px;padding:0 6px;line-height:1}' +
    '.bar{display:flex;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid var(--vscode-panel-border)}' +
    '.ep{background:#2f3136;border-radius:4px;border-left:4px solid #5865F2;padding:12px 16px;max-width:440px;color:#dcddde;font-size:14px;line-height:1.3;margin-top:8px}' +
    '.ep-t{color:#00a8fc;font-weight:600;font-size:16px;margin-bottom:4px}' +
    '.ep-d{color:#dcddde;margin-bottom:8px;white-space:pre-wrap}' +
    '.ep-fs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}' +
    '.ep-f{flex:1;min-width:100px}' +
    '.ep-fn{font-size:13px;font-weight:600;color:#dcddde;margin-bottom:2px}' +
    '.ep-fv{font-size:13px;color:#b9bbbe;white-space:pre-wrap}' +
    '.ep-ft{display:flex;align-items:center;gap:6px;font-size:12px;color:#b9bbbe;margin-top:8px}' +
    '.toast{position:fixed;bottom:16px;right:16px;padding:8px 16px;border-radius:4px;background:var(--vscode-notifications-background);border:1px solid var(--vscode-notifications-border);display:none;z-index:999}' +
    '.toast.show{display:block}' +
  '</style></head><body><div class="cols">' +
  '<div class="left">' +
  '<div class="sec">Content</div>' +
  '<label>Title</label>' + rf(data.title, 0) +
  '<label>Description</label>' + rf(data.description, 1) +
  '<label>URL</label>' + rf(data.url, 2) +
  '<label>Color</label><input id="i3" value="' + esc(data.color.raw || '#5865F2') + '" style="font-family:monospace">' +
  '<div class="sec">Author</div>' +
  '<label>Name</label>' + rf(data.author.name, 4) +
  '<label>Icon URL</label>' + rf(data.author.iconURL, 5) +
  '<div class="sec">Fields</div><div id="fields"></div>' +
  '<button class="pri" onclick="addF()" style="margin-top:4px">+ Add Field</button>' +
  '<div class="sec">Footer</div>' +
  '<label>Text</label>' + rf(data.footer.text, 6) +
  '<label>Icon URL</label>' + rf(data.footer.iconURL, 7) +
  '<div class="sec">Media</div>' +
  '<label>Image URL</label>' + rf(data.image.url, 8) +
  '<label>Thumbnail URL</label>' + rf(data.thumbnail.url, 9) +
  '<div class="bar"><button class="pri" onclick="doSave()">Save</button></div>' +
  '</div>' +
  '<div class="right"><h3 style="font-weight:600;font-size:13px;margin-bottom:8px">Preview</h3><div id="prev" class="ep"><i>Loading preview...</i></div></div>' +
  '</div><div id="toast" class="toast"></div>' +
  '<script>' +
  'var api=acquireVsCodeApi();' +
  'var ed=' + edJson + ';' +
  'var flds=' + fieldsJson + ';' +
  'var keysById=' + keysMap + ';' +
  'function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}' +
  'function prev(){' +
  ' var r="";' +
  ' var tv=ed.title.x||ed.title.v||"";var dv=ed.desc.x||ed.desc.v||"";var fv=ed.footerText.x||ed.footerText.v||"";' +
  ' if(tv) r+="<div class=\"ep-t\">"+esc(tv)+"</div>";' +
  ' if(dv) r+="<div class=\"ep-d\">"+esc(dv)+"</div>";' +
  ' if(flds.length){r+="<div class=\"ep-fs\">";' +
  '  for(var i=0;i<flds.length;i++){' +
  '    r+="<div class=\"ep-f\"><div class=\"ep-fn\">"+esc(flds[i].n.x||flds[i].n.v)+"</div><div class=\"ep-fv\">"+esc(flds[i].v.x||flds[i].v.v)+"</div></div>";' +
  '  } r+="</div>"}' +
  ' if(fv) r+="<div class=\"ep-ft\">"+esc(fv)+"</div>";' +
  ' document.getElementById("prev").innerHTML=r||"<i>(empty embed)</i>"' +
  '}' +
  'function addF(){flds.push({n:{v:"",r:"",t:"literal",x:""},v:{v:"",r:"",t:"literal",x:""},i:{v:false,r:"false",t:"literal",x:false}});renF();prev()}' +
  'function rmF(i){flds.splice(i,1);renF();prev()}' +
  'function renF(){var c=document.getElementById("fields");c.innerHTML="";' +
  'for(var i=0;i<flds.length;i++){' +
  ' var d=document.createElement("div");d.className="frow";' +
  ' var fi=flds[i];' +
  ' var ni=document.createElement("input");ni.className="fn";ni.placeholder="name";ni.value=fi.n.v;' +
  ' var vi=document.createElement("input");vi.className="fv";vi.placeholder="value";vi.value=fi.v.v;' +
  ' var lb=document.createElement("label");lb.style.cssText="display:flex;align-items:center;gap:2px;white-space:nowrap;font-size:11px;margin:0";' +
  ' var cb=document.createElement("input");cb.type="checkbox";cb.checked=fi.i.v===true||fi.i.v==="true";' +
  ' lb.appendChild(cb);lb.appendChild(document.createTextNode(" inline"));' +
  ' var rm=document.createElement("button");rm.className="rm";rm.textContent="\u00D7";' +
  ' (function(idx){ni.oninput=function(){flds[idx].n.v=this.value;flds[idx].n.x=this.value;prev()};' +
  '   vi.oninput=function(){flds[idx].v.v=this.value;flds[idx].v.x=this.value;prev()};' +
  '   cb.onchange=function(){flds[idx].i.v=this.checked;flds[idx].i.x=this.checked;prev()};' +
  '   rm.onclick=function(){flds.splice(idx,1);renF();prev()};' +
  ' })(i);' +
  ' d.appendChild(ni);d.appendChild(vi);d.appendChild(lb);d.appendChild(rm);c.appendChild(d)' +
  '}}' +
  'for(var i=0;i<10;i++){(function(idx){var el=document.getElementById("i"+idx);if(el)el.oninput=function(){prev()}})(i)}' +
  'var c3=document.getElementById("i3");if(c3)c3.oninput=function(){};' +
  'document.getElementById("left").addEventListener("click",function(e){' +
  ' var t=e.target.closest(".trans-tag");if(t){' +
  '  var id=parseInt(t.getAttribute("data-id"),10);var ek=keysById[id];if(ek&&ed[ek]){api.postMessage({type:"pickTrans",key:ed[ek].v,id:id})}' +
  ' }});' +
  'renF();try{prev()}catch(e){document.getElementById("prev").textContent="Error: "+e.message}' +
  'window.addEventListener("message",function(e){var m=e.data;if(m.type==="toast"){var t=document.getElementById("toast");t.textContent=m.text;t.classList.add("show");setTimeout(function(){t.classList.remove("show")},2500)}' +
  'else if(m.type==="transPicked"){var ek=keysById[m.id];if(ek&&ed[ek]){var q=String.fromCharCode(39);ed[ek].v=m.key;ed[ek].r="trans("+q+m.key+q+")";ed[ek].t="trans";ed[ek].x=m.resolved;var el=document.querySelector(\'[data-id="\"+m.id+\'"]\');if(el){el.innerHTML="<span class=\"tk\">trans("+q+m.key+q+")</span><span class=\"ta\">\u2192</span><span class=\"tr\">"+esc(m.resolved)+"</span>"}prev()}});' +
  '</script></body></html>';
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

module.exports = { openEmbedEditor, parseEmbed, generateEmbed };
