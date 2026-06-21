import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { pathToFileURL } from 'url';
import alert from 'cli-alerts';
import { Project, SyntaxKind, Node } from 'ts-morph';

const API_BASE_URL = 'https://modules.zumito.dev/api/modules';

export const installModules = async (moduleNames, { showSuccessAlert = true } = {}) => {
    const requested = (Array.isArray(moduleNames) ? moduleNames : [moduleNames])
        .map(name => typeof name === 'string' ? name.trim() : '')
        .filter(Boolean);

    if (!requested.length) {
        throw new Error('At least one module name is required');
    }

    try {
        const modulesMap = new Map();

        for (const moduleName of requested) {
            const subMap = await collectModules(moduleName);
            for (const [slug, metadata] of subMap.entries()) {
                if (!modulesMap.has(slug)) {
                    modulesMap.set(slug, metadata);
                }
            }
        }

        const modules = Array.from(modulesMap.values());

        if (!modules.length) {
            alert({ type: 'warning', msg: `No module information found for ${requested.join(', ')}` });
            return { modules: [], npmPackages: [], requested };
        }

        const npmPackages = uniqueStrings(modules.map(mod => mod.npm).filter(Boolean));

        if (npmPackages.length) {
            await runNpmInstall(npmPackages);
        } else {
            alert({ type: 'info', msg: 'No npm packages to install for these modules.' });
        }

        const configPath = path.join(process.cwd(), 'zumito.config.ts');
        if (!fs.existsSync(configPath)) {
            alert({
                type: 'warning',
                msg: 'No zumito.config.ts found. Skipping module registration. ' +
                    'Ensure your project root contains this file.'
            });
        } else {
            await registerModules(configPath, modules);
        }

        await runPostInstallHooks(modules);

        if (showSuccessAlert) {
            const successLabel = requested.length > 1 ? 'Modules' : 'Module';
            alert({
                type: 'success',
                msg: `${successLabel} ${requested.join(', ')} installed successfully`
            });
        }

        return { modules, npmPackages, requested };
    } catch (error) {
        alert({ type: 'error', msg: error.message || 'Unexpected error installing module' });
        throw error;
    }
};

export const installModule = {
    command: 'module',
    description: 'Install a Zumito module from modules.zumito.dev',
    options: [
        { label: 'Module name', type: 'string', key: 'name' }
    ],
    action: async ({ name }) => {
        if (!name) {
            alert({ type: 'error', msg: 'Module name is required' });
            return;
        }
        await installModules(name);
    }
};

const collectModules = async (rootName) => {
    if (!rootName) {
        throw new Error('Module name is required');
    }

    const resolved = new Map();
    const visiting = new Set();

    const walk = async (moduleName) => {
        const slug = moduleName.trim().toLowerCase();
        if (resolved.has(slug)) {
            return;
        }
        if (visiting.has(slug)) {
            throw new Error(`Detected circular dependency including module "${moduleName}"`);
        }

        visiting.add(slug);
        const metadata = await fetchModuleMetadata(slug);

        const dependencies = metadata.dependencies ?? [];
        for (const entry of dependencies) {
            const dependencyName = entry?.dependency?.name;
            if (!dependencyName) continue;
            await walk(dependencyName);
        }

        resolved.set(slug, metadata);
        visiting.delete(slug);
    };

    await walk(rootName);
    return resolved;
};

const fetchModuleMetadata = async (moduleName) => {
    const response = await fetch(`${API_BASE_URL}/${moduleName}`);
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Module "${moduleName}" not found`);
        }
        throw new Error(`Failed to fetch module "${moduleName}" (status ${response.status})`);
    }

    return response.json();
};

const uniqueStrings = (values) => {
    const set = new Set();
    const result = [];
    for (const value of values) {
        const normalized = value.trim();
        if (!set.has(normalized)) {
            set.add(normalized);
            result.push(normalized);
        }
    }
    return result;
};

const runNpmInstall = (packages) => new Promise((resolve, reject) => {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npmCommand, ['install', ...packages], {
        cwd: process.cwd(),
        stdio: 'inherit'
    });

    child.on('exit', code => {
        if (code === 0) {
            resolve();
        } else {
            reject(new Error(`npm install exited with code ${code}`));
        }
    });

    child.on('error', reject);
});

const registerModules = async (configPath, modules) => {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(configPath);

    const configObject = findConfigObject(sourceFile);
    if (!configObject) {
        throw new Error('Could not find config object in zumito.config.ts. ' +
            'Expected either `export default defineConfig({...})` or `export const config: LauncherConfig = {...}`.');
    }

    let modulesArray = configObject.getProperty('modules');
    let changed = false;
    if (!modulesArray) {
        modulesArray = configObject.addPropertyAssignment({ name: 'modules', initializer: '[]' });
        changed = true;
    }

    if (!modulesArray || modulesArray.getKind() !== SyntaxKind.PropertyAssignment) {
        throw new Error('Unable to manipulate modules property in config');
    }

    const arrayLiteral = modulesArray.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);
    if (!arrayLiteral) {
        throw new Error('Expected modules property to be an array');
    }

    const orderedPackages = [];
    const packageSet = new Set();
    for (const mod of modules) {
        const npmPackage = mod.npm ? mod.npm.trim() : null;
        if (!npmPackage || packageSet.has(npmPackage)) continue;
        packageSet.add(npmPackage);
        orderedPackages.push(npmPackage);
    }

    if (!orderedPackages.length) {
        if (changed) {
            await sourceFile.save();
        }
        return;
    }

    const existingTexts = new Map();
    const targetInfos = [];
    const elements = arrayLiteral.getElements();
    elements.forEach((element, index) => {
        if (!Node.isStringLiteral(element)) return;
        const value = element.getLiteralText();
        if (!packageSet.has(value)) return;
        if (!existingTexts.has(value)) {
            existingTexts.set(value, element.getText());
        }
        targetInfos.push({ pkg: value, element, index });
    });

    const hasNewPackage = orderedPackages.some(pkg => !existingTexts.has(pkg));
    const existingOrder = targetInfos
        .slice()
        .sort((a, b) => a.index - b.index)
        .map(info => info.pkg);

    if (!hasNewPackage
        && existingOrder.length === orderedPackages.length
        && existingOrder.every((pkg, idx) => pkg === orderedPackages[idx])) {
        if (changed) {
            await sourceFile.save();
        }
        return;
    }

    const insertionIndex = targetInfos.length
        ? Math.min(...targetInfos.map(info => info.index))
        : elements.length;

    targetInfos
        .sort((a, b) => b.index - a.index)
        .forEach(info => {
            arrayLiteral.removeElement(info.element);
            changed = true;
        });

    let cursor = insertionIndex;
    for (const pkg of orderedPackages) {
        if (!existingTexts.has(pkg)) {
            changed = true;
        }
        const elementText = existingTexts.get(pkg) ?? `'${pkg}'`;
        arrayLiteral.insertElement(cursor++, elementText);
    }

    if (changed) {
        await sourceFile.save();
    }
};

const findConfigObject = (sourceFile) => {
    // Try new format: export default defineConfig({...})
    const statements = sourceFile.getStatements();
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
};
