function generateConfig(originalSource, config) {
    const defIdx = originalSource.indexOf('defineConfig(');
    if (defIdx === -1) {
        return originalSource + '\n' + `export default defineConfig(${formatBody(config)})\n`;
    }

    // Find the opening { after defineConfig(
    const openBrace = originalSource.indexOf('{', defIdx);
    if (openBrace === -1) return originalSource;

    const closeBrace = findMatchingBrace(originalSource, openBrace);
    
    const before = originalSource.substring(0, openBrace + 1);
    const after = originalSource.substring(closeBrace);
    
    return before + '\n' + formatBody(config) + '\n' + after;
}

function findMatchingBrace(str, start) {
    let depth = 0;
    let inString = false;
    let stringChar = '';
    let inComment = false;
    
    for (let i = start; i < str.length; i++) {
        const ch = str[i];
        const next = str[i + 1] || '';
        
        // Handle comments
        if (!inString && !inComment && ch === '/' && next === '/') {
            // skip to end of line
            while (i < str.length && str[i] !== '\n') i++;
            continue;
        }
        if (!inString && !inComment && ch === '/' && next === '*') {
            inComment = true;
            i++;
            continue;
        }
        if (inComment && ch === '*' && next === '/') {
            inComment = false;
            i++;
            continue;
        }
        if (inComment) continue;
        
        // Handle strings
        if (!inString && (ch === '"' || ch === "'" || ch === '`')) {
            inString = true;
            stringChar = ch;
            continue;
        }
        if (inString) {
            if (ch === '\\') { i++; continue; }
            if (ch === stringChar) { inString = false; stringChar = ''; }
            continue;
        }
        
        // Handle template literal
        if (ch === '`' && !inString) { this._inTemplate = !this._inTemplate; continue; }
        
        // Count braces
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return str.length - 1;
}

function formatBody(config) {
    const lines = [];
    const g = config.general || {};
    const db = config.database || {};
    const ws = config.webServer || {};
    const mods = config.modules || [];
    const so = config.statusOptions;
    const cb = config.callbacks;

    // statusOptions
    if (so && Object.keys(so).length > 0) {
        lines.push('    statusOptions,');
    }

    // Database
    if (db.default === 'memory') {
        lines.push("    database: { default: 'memory', drivers: { memory: {} } },");
    } else {
        lines.push('    database: {');
        lines.push("        default: '" + db.default + "',");
        lines.push('        drivers: {');
        const drivers = db.drivers || {};
        const entries = Object.entries(drivers);
        for (let i = 0; i < entries.length; i++) {
            const [key, val] = entries[i];
            const cfg = typeof val === 'object' && val !== null ? val : {};
            const keys = Object.keys(cfg);
            if (keys.length === 0) {
                lines.push('            ' + key + ': {},');
            } else {
                lines.push('            ' + key + ': {');
                for (const k of keys) {
                    lines.push("                " + k + ": '" + String(cfg[k]).replace(/'/g, "\\'") + "',");
                }
                lines.push('            },');
            }
        }
        lines.push('        },');
        lines.push('    },');
    }

    // Modules
    if (mods.length > 0) {
        lines.push('    modules: [');
        for (const mod of mods) {
            if (mod.type === 'factory') {
                if (mod.config && Object.keys(mod.config).length > 0) {
                    lines.push('        ' + mod.name + '(' + toTsValue(mod.config, 10) + '),');
                } else {
                    lines.push('        ' + mod.name + '(),');
                }
            } else {
                lines.push("        '" + mod.name + "',");
            }
        }
        lines.push('    ],');
    } else {
        lines.push('    modules: [],');
    }

    // General
    if (g.logLevel !== undefined && g.logLevel !== 3) lines.push('    logLevel: ' + g.logLevel + ',');
    if (g.debug) lines.push('    debug: true,');
    if (g.defaultPrefix && g.defaultPrefix !== 'z-') lines.push("    defaultPrefix: '" + String(g.defaultPrefix).replace(/'/g, "\\'") + "',");
    if (g.srcMode) lines.push("    srcMode: '" + g.srcMode + "',");

    // WebServer
    if (ws.port || ws.disableNotFoundHandler) {
        lines.push('    webServer: {');
        if (ws.port) lines.push('        port: ' + ws.port + ',');
        if (ws.disableNotFoundHandler) lines.push('        disableNotFoundHandler: true,');
        lines.push('    },');
    }

    // Callbacks
    if (cb && cb.hasLoad) lines.push('    callbacks: { load: () => {} },');

    return lines.join('\n');
}

/** Convert a parsed value back to TypeScript syntax, handling __ref: identifiers */
function toTsValue(val, indent = 0) {
    const pad = ' '.repeat(indent);
    if (typeof val === 'string' && val.startsWith('__ref:')) {
        return val.slice(6);
    }
    if (Array.isArray(val)) {
        if (val.length === 0) return '[]';
        if (val.every(v => typeof v === 'string')) {
            return '[' + val.map(v => "'" + String(v).replace(/'/g, "\\'") + "'").join(', ') + ']';
        }
        return '[' + val.map(v => toTsValue(v, indent + 2)).join(', ') + ']';
    }
    if (typeof val === 'object' && val !== null) {
        if (Object.keys(val).length === 0) return '{}';
        const parts = [];
        for (const [k, v] of Object.entries(val)) {
            const formatted = toTsValue(v, indent + 4);
            if (formatted.includes('\n')) {
                parts.push(pad + '    ' + k + ': ' + formatted);
            } else {
                parts.push(pad + '    ' + k + ': ' + formatted);
            }
        }
        return '{\n' + parts.join(',\n') + ',\n' + pad + '}';
    }
    if (typeof val === 'string') return "'" + val.replace(/'/g, "\\'") + "'";
    return JSON.stringify(val);
}

module.exports = { generateConfig };
