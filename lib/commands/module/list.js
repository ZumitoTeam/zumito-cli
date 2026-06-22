import path from 'path';
import chalk from 'chalk';
import alert from 'cli-alerts';
import { getInstalledModules } from '../../utils/configEditor.js';

export const moduleList = {
    command: 'list',
    description: 'List all installed external modules from zumito.config.ts',
    options: [],
    jsonOption: true,
    action: async (params) => {
        const configPath = path.join(process.cwd(), 'zumito.config.ts');
        const modules = getInstalledModules(configPath);

        if (params.json) {
            process.stdout.write(JSON.stringify(modules, null, 2));
            return;
        }

        if (modules.length === 0) {
            alert({ type: 'info', msg: 'No modules found in zumito.config.ts' });
            return;
        }

        console.log(chalk.bold(`\n📦 Modules (${modules.length})\n`));

        for (const mod of modules) {
            const label = mod.kind === 'call' ? `${mod.name}()` : mod.name;
            console.log(`  ${chalk.blue('•')} ${chalk.bold(label)}`);

            if (mod.config && Object.keys(mod.config).length > 0) {
                for (const [key, value] of Object.entries(mod.config)) {
                    const valStr = typeof value === 'string' ? `"${value}"` : String(value);
                    console.log(`    ${chalk.dim(key)}: ${chalk.green(valStr)}`);
                }
            } else if (mod.kind === 'string') {
                console.log(`    ${chalk.dim('(no config)')}`);
            }

            console.log();
        }
    }
};
