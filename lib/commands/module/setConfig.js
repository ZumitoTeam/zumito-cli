import path from 'path';
import alert from 'cli-alerts';
import { getInstalledModules, updateModuleConfig, addModule } from '../../utils/configEditor.js';

export const moduleSetConfig = {
    command: 'set-config',
    description: 'Set module configuration non-interactively.',
    options: [
        { label: 'Module name', type: 'string', key: 'name' },
        { label: 'Config as JSON', type: 'string', key: 'config' },
    ],
    action: async (params) => {
        const configPath = path.join(process.cwd(), 'zumito.config.ts');

        if (!params.name) {
            alert({ type: 'error', msg: '--name is required' });
            return;
        }

        let config = {};
        if (params.config) {
            try {
                config = JSON.parse(params.config);
            } catch {
                alert({ type: 'error', msg: '--config must be valid JSON (e.g. \'{"key":"value"}\')' });
                return;
            }
        }

        const modules = getInstalledModules(configPath);
        const exists = modules.some(m => m.name === params.name);

        if (exists) {
            updateModuleConfig(configPath, params.name, config);
        } else {
            addModule(configPath, params.name, config);
        }

        alert({ type: 'success', msg: `Module "${params.name}" configuration updated` });
    }
};
