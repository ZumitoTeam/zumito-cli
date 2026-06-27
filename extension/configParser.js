const { Project, SyntaxKind, Node } = require('ts-morph');
const ShorthandPropertyAssignment = SyntaxKind.ShorthandPropertyAssignment;

/**
 * Parse a zumito.config.ts file and extract the configuration object.
 * Returns a JSON-serializable representation.
 */
function parseConfig(source) {
    const project = new Project({ useInMemoryFileSystem: true });
    const file = project.createSourceFile('zumito.config.ts', source);

    const result = {
        general: { logLevel: 3, debug: false, defaultPrefix: 'z-', srcMode: undefined },
        database: { default: 'memory', drivers: {} },
        modules: [],
        webServer: { port: undefined, disableNotFoundHandler: false },
        statusOptions: undefined,
        callbacks: undefined,
    };

    // Find defineConfig() call
    const defineCall = findDefineConfigCall(file);
    if (!defineCall) return result;

    const configArg = defineCall.getArguments()[0];
    if (!configArg || !Node.isObjectLiteralExpression(configArg)) return result;

// Parse each property
        for (const prop of configArg.getProperties()) {
            if (!Node.isPropertyAssignment(prop) && !Node.isShorthandPropertyAssignment(prop)) continue;
            const name = prop.getName();
            const initializer = Node.isPropertyAssignment(prop) ? prop.getInitializer() : null;

        switch (name) {
            case 'logLevel':
                result.general.logLevel = extractNumber(prop);
                break;
            case 'debug':
                result.general.debug = extractBoolean(prop);
                break;
            case 'defaultPrefix':
                result.general.defaultPrefix = extractString(prop);
                break;
            case 'srcMode':
                result.general.srcMode = extractString(prop);
                break;
            case 'database':
                result.database = parseDatabase(prop);
                break;
            case 'modules':
                result.modules = parseModules(prop);
                break;
            case 'webServer':
                result.webServer = parseWebServer(prop);
                break;
            case 'statusOptions':
                if (Node.isShorthandPropertyAssignment(prop)) {
                    result.statusOptions = {};
                    result._statusRef = true;
                } else {
                    result.statusOptions = parseObject(prop);
                }
                break;
            case 'callbacks':
                result.callbacks = parseCallbacks(prop);
                break;
            case 'discordClientOptions':
                // Auto-injected from env, skip
                break;
        }
    }

    return result;
}

function findDefineConfigCall(file) {
    // Look for defineConfig() call
    const calls = file.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of calls) {
        const expr = call.getExpression();
        if (Node.isIdentifier(expr) && expr.getText() === 'defineConfig') {
            return call;
        }
    }
    return null;
}

function extractNumber(prop) {
    const init = prop.getInitializer();
    if (!init) return undefined;
    if (Node.isNumericLiteral(init)) return init.getLiteralValue();
    return undefined;
}

function extractString(prop) {
    const init = prop.getInitializer();
    if (!init) return undefined;
    if (Node.isStringLiteral(init)) return init.getLiteralValue();
    return undefined;
}

function extractBoolean(prop) {
    const init = prop.getInitializer();
    if (!init) return undefined;
    if (init.getKind() === SyntaxKind.TrueKeyword) return true;
    if (init.getKind() === SyntaxKind.FalseKeyword) return false;
    return undefined;
}

function parseDatabase(prop) {
    const init = prop.getInitializer();
    if (!init || !Node.isObjectLiteralExpression(init)) {
        return { default: 'memory', drivers: {} };
    }

    const result = { default: 'memory', drivers: {} };

    for (const p of init.getProperties()) {
        if (!Node.isPropertyAssignment(p)) continue;
        const name = p.getName();

        if (name === 'default') {
            result.default = extractString(p) || 'memory';
        } else if (name === 'drivers') {
            result.drivers = parseDrivers(p);
        }
    }

    return result;
}

function parseDrivers(prop) {
    const init = prop.getInitializer();
    if (!init || !Node.isObjectLiteralExpression(init)) return {};

    const drivers = {};
    for (const p of init.getProperties()) {
        if (!Node.isPropertyAssignment(p)) continue;
        const driverName = p.getName();
        const driverConfig = parseObject(p);
        drivers[driverName] = driverConfig || {};
    }
    return drivers;
}

function parseModules(prop) {
    const init = prop.getInitializer();
    if (!init || !Node.isArrayLiteralExpression(init)) return [];

    const modules = [];
    for (const el of init.getElements()) {
        if (Node.isCallExpression(el)) {
            const callee = el.getExpression();
            if (Node.isIdentifier(callee)) {
                const name = callee.getText();
                const args = el.getArguments();
                const config = args.length > 0 && Node.isObjectLiteralExpression(args[0])
                    ? parseObjectRaw(args[0])
                    : {};
                modules.push({ type: 'factory', name, config });
            }
        } else if (Node.isStringLiteral(el)) {
            modules.push({ type: 'string', name: el.getLiteralValue() });
        }
    }
    return modules;
}

function parseWebServer(prop) {
    const init = prop.getInitializer();
    if (!init || !Node.isObjectLiteralExpression(init)) {
        return { port: undefined, disableNotFoundHandler: false };
    }

    const result = { port: undefined, disableNotFoundHandler: false };
    for (const p of init.getProperties()) {
        if (!Node.isPropertyAssignment(p)) continue;
        if (p.getName() === 'port') result.port = extractNumber(p);
        if (p.getName() === 'disableNotFoundHandler') result.disableNotFoundHandler = extractBoolean(p) || false;
    }
    return result;
}

function parseCallbacks(prop) {
    const init = prop.getInitializer();
    if (!init || !Node.isObjectLiteralExpression(init)) return undefined;

    // Just track if there's a load callback
    for (const p of init.getProperties()) {
        if (Node.isPropertyAssignment(p) && p.getName() === 'load') {
            return { hasLoad: true };
        }
    }
    return undefined;
}

function parseObject(prop) {
    const init = prop.getInitializer();
    if (!init) return undefined;
    if (Node.isObjectLiteralExpression(init)) {
        return parseObjectRaw(init);
    }
    return undefined;
}

function parseObjectRaw(obj) {
    const result = {};
    for (const prop of obj.getProperties()) {
        if (!Node.isPropertyAssignment(prop)) continue;
        const name = prop.getName();
        const init = prop.getInitializer();
        if (!init) continue;

        if (Node.isStringLiteral(init)) {
            result[name] = init.getLiteralValue();
        } else if (Node.isNumericLiteral(init)) {
            result[name] = init.getLiteralValue();
        } else if (init.getKind() === SyntaxKind.TrueKeyword) {
            result[name] = true;
        } else if (init.getKind() === SyntaxKind.FalseKeyword) {
            result[name] = false;
        } else if (Node.isObjectLiteralExpression(init)) {
            result[name] = parseObjectRaw(init);
        } else if (Node.isArrayLiteralExpression(init)) {
            result[name] = init.getElements().map(e => {
                if (Node.isStringLiteral(e)) return e.getLiteralValue();
                if (Node.isObjectLiteralExpression(e)) return parseObjectRaw(e);
                if (Node.isNumericLiteral(e)) return e.getLiteralValue();
                return null;
            }).filter(Boolean);
        } else if (Node.isIdentifier(init)) {
            result[name] = `__ref:${init.getText()}`;
        } else {
            result[name] = init.getText();
        }
    }
    return result;
}

module.exports = { parseConfig };
