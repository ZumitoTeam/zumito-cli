import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import alert from 'cli-alerts';
import { getInstalledModules, updateModuleConfig } from '../../utils/configEditor.js';

export const moduleConfig = {
    command: 'config',
    description: 'Edit module configuration interactively',
    options: [
        { label: 'Module name', type: 'string', key: 'name' }
    ],
    action: async ({ name }) => {
        const configPath = path.join(process.cwd(), 'zumito.config.ts');
        const modules = getInstalledModules(configPath);

        if (modules.length === 0) {
            alert({ type: 'info', msg: 'No modules found in zumito.config.ts' });
            return;
        }

        let moduleName = name;

        // If no name given, show picker
        if (!moduleName) {
            const choices = modules.map(m => ({
                name: m.kind === 'call' ? `${m.name}()` : m.name,
                value: m.name,
            }));
            const answer = await inquirer.prompt([{
                type: 'list',
                name: 'module',
                message: 'Select a module to configure:',
                choices,
            }]);
            moduleName = answer.module;
        }

        const target = modules.find(m => m.name === moduleName);
        if (!target) {
            alert({ type: 'error', msg: `Module "${moduleName}" not found in config` });
            return;
        }

        console.log(chalk.bold(`\nConfiguring ${moduleName}\n`));

        const currentConfig = target.config || {};

        // Ask for each config key — add, edit, or remove
        const actionAnswer = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'What do you want to do?',
            choices: [
                { name: 'Edit existing values', value: 'edit' },
                { name: 'Add a new key', value: 'add' },
                { name: 'Remove a key', value: 'remove' },
                { name: 'Clear all config', value: 'clear' },
                { name: 'Cancel', value: 'cancel' },
            ],
        }]);

        if (actionAnswer.action === 'cancel') {
            console.log(chalk.dim('Cancelled.'));
            return;
        }

        let newConfig = { ...currentConfig };

        if (actionAnswer.action === 'edit') {
            const keys = Object.keys(newConfig);
            if (keys.length === 0) {
                alert({ type: 'info', msg: 'No existing config keys to edit. Add a new key first.' });
                return;
            }

            for (const key of keys) {
                const currentVal = newConfig[key];
                const valStr = typeof currentVal === 'string' ? currentVal : JSON.stringify(currentVal);

                const answer = await inquirer.prompt([{
                    type: 'input',
                    name: 'value',
                    message: `${key}:`,
                    default: valStr,
                }]);

                // Try to parse as number/boolean if applicable
                newConfig[key] = parseInputValue(answer.value);
            }
        } else if (actionAnswer.action === 'add') {
            const keyAnswer = await inquirer.prompt([{
                type: 'input',
                name: 'key',
                message: 'Key name:',
                validate: input => input.trim() ? true : 'Key name cannot be empty',
            }]);

            const valueAnswer = await inquirer.prompt([{
                type: 'input',
                name: 'value',
                message: `Value for "${keyAnswer.key}":`,
            }]);

            newConfig[keyAnswer.key] = parseInputValue(valueAnswer.value);
        } else if (actionAnswer.action === 'remove') {
            const keys = Object.keys(newConfig);
            if (keys.length === 0) {
                alert({ type: 'info', msg: 'No keys to remove.' });
                return;
            }

            const keyAnswer = await inquirer.prompt([{
                type: 'list',
                name: 'key',
                message: 'Select key to remove:',
                choices: keys,
            }]);

            delete newConfig[keyAnswer.key];
        } else if (actionAnswer.action === 'clear') {
            newConfig = {};
        }

        try {
            updateModuleConfig(configPath, moduleName, newConfig);
            alert({ type: 'success', msg: `Configuration for "${moduleName}" updated` });
        } catch (err) {
            alert({ type: 'error', msg: err.message });
        }
    }
};

function parseInputValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
    if (/^\{/.test(value) || /^\[/.test(value)) {
        try { return JSON.parse(value); } catch { return value; }
    }
    return value;
}
