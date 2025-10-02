import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { pathToFileURL } from 'url';
import alert from 'cli-alerts';
import { Project, SyntaxKind, Node } from 'ts-morph';

const API_BASE_URL = 'https://modules.zumito.dev/api/modules';

export const installModule = {
    command: 'module',
    description: 'Install a Zumito module from modules.zumito.dev',
    options: [
        { label: 'Module name', type: 'string', key: 'name' }
    ],
    action: async ({ name }) => {
        try {
            const modulesMap = await collectModules(name);
            const modules = Array.from(modulesMap.values());

            if (!modules.length) {
                alert({ type: 'warning', msg: `No module information found for ${name}` });
                return;
            }

            const npmPackages = uniqueStrings(modules.map(mod => mod.npm).filter(Boolean));

            if (npmPackages.length) {
                await runNpmInstall(npmPackages);
            } else {
                alert({ type: 'info', msg: 'No npm packages to install for this module.' });
            }

            const configPath = path.join(process.cwd(), 'zumito.config.ts');
            if (!fs.existsSync(configPath)) {
                alert({
                    type: 'warning',
                    msg: 'No zumito.config.ts found. Skipping bundle registration. '
                        + 'Ensure your project root contains this file.'
                });
            } else {
                await registerBundles(configPath, modules);
            }

            await runPostInstallHooks(modules);

            alert({
                type: 'success',
                msg: `Module ${name} installed successfully`
            });
        } catch (error) {
            alert({ type: 'error', msg: error.message || 'Unexpected error installing module' });
            throw error;
        }
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

const registerBundles = async (configPath, modules) => {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(configPath);

    const pathImportAdded = ensurePathImport(sourceFile);

    const configDeclaration = sourceFile.getVariableDeclaration('config');
    if (!configDeclaration) {
        throw new Error('Could not find exported config in zumito.config.ts');
    }

    let initializer = configDeclaration.getInitializer();
    if (!initializer) {
        throw new Error('Config initializer not found');
    }

    if (Node.isAsExpression(initializer)) {
        initializer = initializer.getExpression();
    }

    if (initializer.getKind() !== SyntaxKind.ObjectLiteralExpression) {
        throw new Error('Expected config to be initialized with an object literal');
    }

    const configObject = initializer;

    let bundlesProperty = configObject.getProperty('bundles');
    let changed = Boolean(pathImportAdded);
    if (!bundlesProperty) {
        bundlesProperty = configObject.addPropertyAssignment({ name: 'bundles', initializer: '[]' });
        changed = true;
    }

    if (!bundlesProperty || bundlesProperty.getKind() !== SyntaxKind.PropertyAssignment) {
        throw new Error('Unable to manipulate bundles property in config');
    }

    const bundlesArray = bundlesProperty.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);
    if (!bundlesArray) {
        throw new Error('Expected bundles property to be an array');
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

    const existingBundleTexts = new Map();
    const targetInfos = [];
    const elements = bundlesArray.getElements();
    elements.forEach((element, index) => {
        const pkg = extractBundlePackageName(element);
        if (!pkg || !packageSet.has(pkg)) {
            return;
        }
        if (!existingBundleTexts.has(pkg)) {
            existingBundleTexts.set(pkg, element.getText());
        }
        targetInfos.push({ pkg, element, index });
    });

    const hasNewPackage = orderedPackages.some(pkg => !existingBundleTexts.has(pkg));
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
            bundlesArray.removeElement(info.element);
            changed = true;
        });

    let cursor = insertionIndex;
    for (const pkg of orderedPackages) {
        const elementText = existingBundleTexts.get(pkg) ?? createBundleEntry(pkg);
        if (!existingBundleTexts.has(pkg)) {
            changed = true;
        }
        bundlesArray.insertElement(cursor++, elementText);
    }

    if (changed) {
        await sourceFile.save();
    }
};

const ensurePathImport = (sourceFile) => {
    const hasImport = sourceFile.getImportDeclarations().some(decl => {
        const specifier = decl.getModuleSpecifierValue();
        return specifier === 'path' || specifier === 'node:path';
    });

    if (!hasImport) {
        sourceFile.addImportDeclaration({
            defaultImport: 'path',
            moduleSpecifier: 'path'
        });
        return true;
    }

    return false;
};

const createBundleEntry = (npmPackage) => {
    const parts = npmPackage.split('/').filter(Boolean);
    const args = ['__dirname', '"node_modules"', ...parts.map(part => `"${part}"`)];
    const joinCall = `path.join(${args.join(', ')})`;
    return `{ path: ${joinCall} }`;
};

const extractBundlePackageName = (element) => {
    if (!Node.isObjectLiteralExpression(element)) {
        return null;
    }

    const pathProp = element.getProperty('path');
    if (!pathProp || !Node.isPropertyAssignment(pathProp)) {
        return null;
    }

    const initializer = pathProp.getInitializer();
    if (!initializer || !Node.isCallExpression(initializer)) {
        return null;
    }

    const expression = initializer.getExpression();
    if (!expression || expression.getText() !== 'path.join') {
        return null;
    }

    const args = initializer.getArguments();
    if (args.length < 3) {
        return null;
    }

    const stringArgs = args
        .slice(2)
        .map(arg => Node.isStringLiteral(arg) ? arg.getLiteralText() : null);

    if (stringArgs.some(value => value === null)) {
        return null;
    }

    return stringArgs.join('/');
};


const runPostInstallHooks = async (modules) => {
    const executed = new Set();

    for (const mod of modules) {
        if (!mod.npm) continue;
        const npmPackage = mod.npm.trim();
        if (executed.has(npmPackage)) continue;

        executed.add(npmPackage);
        const moduleDir = path.join(process.cwd(), 'node_modules', ...npmPackage.split('/').filter(Boolean));
        const configFile = path.join(moduleDir, 'moduleConfig.js');

        if (!fs.existsSync(configFile)) {
            continue;
        }

        try {
            const imported = await import(pathToFileURL(configFile).href);
            const moduleConfig = imported.moduleConfig || imported.default?.moduleConfig || imported.default;
            if (moduleConfig && typeof moduleConfig.install === 'function') {
                await moduleConfig.install();
            }
        } catch (error) {
            alert({
                type: 'warning',
                msg: `Failed to execute install hook for ${npmPackage}: ${error.message}`
            });
        }
    }
};
