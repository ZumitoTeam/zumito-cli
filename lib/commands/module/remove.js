import path from 'path';
import alert from 'cli-alerts';
import { removeModule as removeFromConfig } from '../../utils/configEditor.js';

export const moduleRemove = {
    command: 'remove',
    description: 'Remove a module from zumito.config.ts',
    options: [
        { label: 'Module name', type: 'string', key: 'name' }
    ],
    action: async ({ name }) => {
        if (!name) {
            alert({ type: 'error', msg: 'Module name is required' });
            return;
        }

        const configPath = path.join(process.cwd(), 'zumito.config.ts');
        const removed = removeFromConfig(configPath, name);

        if (removed) {
            alert({ type: 'success', msg: `Module "${name}" removed from config` });
            console.log('  Note: The npm package remains installed. Run "npm uninstall <package>" to remove it.');
        } else {
            alert({ type: 'warning', msg: `Module "${name}" not found in config` });
        }
    }
};
