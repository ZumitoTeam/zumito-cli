import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import alert from 'cli-alerts';
import chalk from 'chalk';

import { createProject, projectOptions } from './create/project.js';

const easybotOptions = projectOptions.filter(option => option.key !== 'projectName');

export const easybot = {
    command: 'easybot',
    description: 'Create a new Zumito bot in the current directory and start it',
    options: easybotOptions,
    action: async (params) => {
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
                ...params,
            }, {
                targetDir: '.',
                showNextSteps: false,
            });
        } catch (error) {
            // createProject already reports errors with alerts
            throw error;
        }

        alert({
            type: 'success',
            msg: 'Bot scaffolded successfully',
        });

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
