import fs from 'fs';
import path from 'path';
import { Project, SyntaxKind, Node } from 'ts-morph';

/**
 * Find the config object expression in a zumito.config.ts source file.
 * Supports:
 *   - export default defineConfig({...})
 *   - export const config: LauncherConfig = {...}
 */
export function findConfigObject(sourceFile) {
    const statements = sourceFile.getStatements();

    // Try new format: export default defineConfig({...})
    for (const stmt of statements) {
        if (Node.isExportAssignment(stmt)) {
            const expr = stmt.getExpression();
            if (Node.isCallExpression(expr)) {
                const callee = expr.getExpression();
                if (callee.getText() === 'defineConfig') {
                    const args = expr.getArguments();
                    if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
                        return args[0];
                    }
                }
            }
        }
    }

    // Fallback to old format: export const config: LauncherConfig = {...}
    const configDecl = sourceFile.getVariableDeclaration('config');
    if (configDecl) {
        let initializer = configDecl.getInitializer();
        if (!initializer) return null;
        if (Node.isAsExpression(initializer)) {
            initializer = initializer.getExpression();
        }
        if (Node.isObjectLiteralExpression(initializer)) {
            return initializer;
        }
    }

    return null;
}

/**
 * Parse a single module entry element into {name, config, rawText, nodeType}.
 * Also returns variables (keys whose value is a variable reference, not a literal).
 */
export function parseModuleEntry(element) {
    if (Node.isStringLiteral(element)) {
        return {
            name: element.getLiteralText(),
            config: null,
            variables: {},
            rawText: element.getText(),
            kind: 'string',
        };
    }

    if (Node.isCallExpression(element)) {
        const callee = element.getExpression().getText();
        const args = element.getArguments();
        let config = null;
        let variables = {};
        if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
            const parsed = parseObjectLiteral(args[0]);
            config = parsed.values;
            variables = parsed.variables;
        }
        return {
            name: callee,
            config,
            variables,
            rawText: element.getText(),
            kind: 'call',
        };
    }

    if (Node.isIdentifier(element)) {
        return {
            name: element.getText(),
            config: null,
            variables: {},
            rawText: element.getText(),
            kind: 'identifier',
        };
    }

    return {
        name: element.getText(),
        config: null,
        rawText: element.getText(),
        kind: 'unknown',
    };
}

/**
 * Parse an ObjectLiteralExpression into {values: {...}, variables: {...}}.
 * variables tracks keys whose value is a variable reference (e.g. `colors: palette`).
 */
function parseObjectLiteral(objLit) {
    const values = {};
    const variables = {};
    for (const prop of objLit.getProperties()) {
        if (!Node.isPropertyAssignment(prop)) continue;
        const key = prop.getName();
        const initializer = prop.getInitializer();
        if (!initializer) continue;
        if (Node.isIdentifier(initializer)) {
            // Variable reference like `colors: palette`
            variables[key] = initializer.getText();
            values[key] = initializer.getText();
        } else {
            values[key] = parseLiteralValue(initializer);
        }
    }
    return { values, variables };
}

function parseLiteralValue(node) {
    if (Node.isStringLiteral(node)) return node.getLiteralText();
    if (Node.isNumericLiteral(node)) return Number(node.getText());
    if (node.getKind() === SyntaxKind.TrueKeyword) return true;
    if (node.getKind() === SyntaxKind.FalseKeyword) return false;
    if (node.getKind() === SyntaxKind.NullKeyword) return null;
    if (Node.isObjectLiteralExpression(node)) {
        const parsed = parseObjectLiteral(node);
        return parsed.values;
    }
    if (Node.isArrayLiteralExpression(node)) {
        return node.getElements().map(e => parseLiteralValue(e));
    }
    return node.getText();
}

/**
 * Get the modules array node from a config object.
 */
export function getModulesArray(configObject) {
    const prop = configObject.getProperty('modules');
    if (!prop || prop.getKind() !== SyntaxKind.PropertyAssignment) return null;
    return prop.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);
}

/**
 * Read all installed modules from zumito.config.ts.
 * Returns an array of {name, config, rawText, kind}.
 */
export function getInstalledModules(configPath) {
    if (!fs.existsSync(configPath)) return [];

    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(configPath);
    const configObject = findConfigObject(sourceFile);
    if (!configObject) return [];

    const modulesArray = getModulesArray(configObject);
    if (!modulesArray) return [];

    return modulesArray.getElements().map(el => parseModuleEntry(el));
}

/**
 * Get the effective name out of a module entry element.
 */
export function resolveElementName(element) {
    if (Node.isStringLiteral(element)) return element.getLiteralText();
    if (Node.isCallExpression(element)) return element.getExpression().getText();
    if (Node.isIdentifier(element)) return element.getText();
    return element.getText();
}

/**
 * Add a module to the config.
 * @param {string} configPath
 * @param {string} moduleName - npm package name (e.g. '@zumito-team/analytics-module')
 * @param {object|null} moduleConfig - optional config object
 * @returns {boolean} true if added, false if already exists
 */
export function addModule(configPath, moduleName, moduleConfig = null) {
    if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found at ${configPath}`);
    }

    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(configPath);
    const configObject = findConfigObject(sourceFile);
    if (!configObject) {
        throw new Error('Could not find config object in zumito.config.ts');
    }

    let modulesProp = configObject.getProperty('modules');
    let changed = false;

    if (!modulesProp) {
        modulesProp = configObject.addPropertyAssignment({
            name: 'modules',
            initializer: '[]',
        });
        changed = true;
    }

    const arrayLiteral = modulesProp.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);
    if (!arrayLiteral) {
        throw new Error('Expected modules property to be an array');
    }

    // Check if already exists
    const existing = arrayLiteral.getElements().find(el => resolveElementName(el) === moduleName);
    if (existing) return false;

    let elementText;
    if (moduleConfig && Object.keys(moduleConfig).length > 0) {
        const configStr = objectToTsString(moduleConfig, '        ');
        elementText = `${moduleName}(${configStr})`;
    } else {
        elementText = `'${moduleName}'`;
    }

    arrayLiteral.addElement(elementText);
    sourceFile.saveSync();
    return true;
}

/**
 * Remove a module from the config by name.
 * @returns {boolean} true if removed
 */
export function removeModule(configPath, moduleName) {
    if (!fs.existsSync(configPath)) return false;

    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(configPath);
    const configObject = findConfigObject(sourceFile);
    if (!configObject) return false;

    const modulesArray = getModulesArray(configObject);
    if (!modulesArray) return false;

    const elements = modulesArray.getElements();
    const targetIndex = elements.findIndex(el => resolveElementName(el) === moduleName);
    if (targetIndex === -1) return false;

    modulesArray.removeElement(elements[targetIndex]);
    sourceFile.saveSync();
    return true;
}

/**
 * Update the config object of a factory-call module entry.
 * If the entry is a plain string, converts it to a factory call.
 */
export function updateModuleConfig(configPath, moduleName, newConfig) {
    if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found at ${configPath}`);
    }

    const project = new Project({ manipulationSettings: { insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: false } });
    const sourceFile = project.addSourceFileAtPath(configPath);
    const configObject = findConfigObject(sourceFile);
    if (!configObject) {
        throw new Error('Could not find config object in zumito.config.ts');
    }

    const modulesArray = getModulesArray(configObject);
    if (!modulesArray) {
        throw new Error('No modules array found in config');
    }

    const elements = modulesArray.getElements();
    const targetEl = elements.find(el => resolveElementName(el) === moduleName);
    if (!targetEl) {
        throw new Error(`Module "${moduleName}" not found in config`);
    }

    // Build multi-line config string preserving indentation
    const configStr = objectToTsString(newConfig || {}, '        ');
    const newText = `${moduleName}(${configStr})`;

    const index = elements.indexOf(targetEl);
    modulesArray.removeElement(targetEl);
    modulesArray.insertElement(index, newText);
    sourceFile.saveSync();
}

/**
 * Convert a JS object to a TypeScript object literal string.
 */
function objectToTsString(obj, indent) {
    if (!obj || Object.keys(obj).length === 0) return '{}';
    const inner = indent || '    ';
    const entries = Object.entries(obj).map(([key, value]) => {
        return `${inner}${key}: ${valueToTsString(value)}`;
    });
    return `{\n${entries.join(',\n')}\n${inner.slice(0, -4)}}`;
}

function valueToTsString(value) {
    if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) {
        return `[${value.map(v => valueToTsString(v)).join(', ')}]`;
    }
    if (typeof value === 'object') return objectToTsString(value);
    return String(value);
}
