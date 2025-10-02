import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import alert from 'cli-alerts';
import chalk from 'chalk';

import { createProject } from './create/project.js';
import { installModules } from './install/module.js';

export const easybot = {
    command: 'easybot',
    description: 'Create a new Zumito bot in the current directory and start it',
    options: [],
    action: async () => {
        let envConfig;
        try {
            envConfig = readEnvironmentConfig();
        } catch (error) {
            alert({
                type: 'error',
                msg: error.message,
            });
            throw error;
        }

        try {
            ensureDirectoryIsEmpty(process.cwd());
        } catch (error) {
            alert({
                type: 'error',
                msg: error.message,
            });
            throw error;
        }

        try {
            await createProject({
                projectName: '.',
                ...envConfig.projectOptions,
            }, {
                targetDir: '.',
                showNextSteps: false,
            });
        } catch (error) {
            throw error;
        }

        alert({
            type: 'success',
            msg: 'Bot scaffolded successfully',
        });

        if (envConfig.modules.length) {
            console.log(chalk.cyan(`Installing modules: ${envConfig.modules.join(', ')}`));
            try {
                await installModules(envConfig.modules, { showSuccessAlert: false });
                alert({
                    type: 'success',
                    msg: `Modules ${envConfig.modules.join(', ')} installed successfully`,
                });
            } catch (error) {
                alert({
                    type: 'error',
                    msg: `Failed to install modules: ${error.message}`,
                });
                throw error;
            }
        }

        console.log(chalk.cyan('Starting bot with "npm run start". Press Ctrl+C to stop.'));

        try {
            await runNpmScript('start', process.cwd());
        } catch (error) {
            alert({
                type: 'error',
                msg: 'Failed to start the bot',
            });
            throw error;
        }
    }
};

const readEnvironmentConfig = () => {
    const requiredEnvMap = {
        DISCORD_TOKEN: 'discordToken',
        DISCORD_CLIENT_ID: 'discordClientId',
        DISCORD_CLIENT_SECRET: 'discordClientSecret',
        MONGO_QUERY_STRING: 'mongoQueryString',
    };

    const projectOptions = {};
    const missing = [];

    for (const [envKey, optionKey] of Object.entries(requiredEnvMap)) {
        const value = process.env[envKey];
        if (!value) {
            missing.push(envKey);
        } else {
            projectOptions[optionKey] = value;
        }
    }

    if (missing.length) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    projectOptions.botPrefix = process.env.BOT_PREFIX ?? 'zt-';

    const modules = parseModulesEnv(process.env.MODULES);

    return { projectOptions, modules };
};

const parseModulesEnv = (value) => {
    if (!value) return [];
    return value
        .split(',')
        .map(entry => entry.trim())
        .filter(Boolean);
};

const ensureDirectoryIsEmpty = (dir) => {
    const resolved = path.resolve(dir);
    const entries = fs.readdirSync(resolved);
    if (entries.length > 0) {
        throw new Error('Current directory is not empty. Please run easybot in an empty folder.');
    }
};

const runNpmScript = (script, cwd) => new Promise((resolve, reject) => {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npmCommand, ['run', script], {
        cwd,
        stdio: 'inherit'
    });

    child.on('exit', code => {
        if (code === 0) {
            resolve();
        } else {
            reject(new Error(`npm run ${script} exited with code ${code}`));
        }
    });

    child.on('error', reject);
});
