import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import alert from 'cli-alerts';

export const projectOptions = [{
    label: "Project name",
    type: "string",
    key: "projectName"
}, {
    label: 'Discord bot token',
    type: 'string',
    key: 'discordToken'
},
{
    label: 'Discord client ID',
    type: 'string',
    key: 'discordClientId'
},
{
    label: 'Discord client secret',
    type: 'string',
    key: 'discordClientSecret'
},
{
    label: 'Default prefix',
    type: 'string',
    key: 'botPrefix'
},
{
    label: 'Mongo query string',
    type: 'string',
    key: 'mongoQueryString',
}];

export const createProject = async (
    {
        projectName,
        discordToken,
        discordClientId,
        discordClientSecret,
        botPrefix,
        mongoQueryString
    },
    {
        targetDir,
        installDependencies = true,
        showNextSteps = true
    } = {}
) => {
    const destination = targetDir ?? projectName;

    if (!destination) {
        throw new Error('Either projectName or targetDir must be provided');
    }

    const absoluteTargetDir = path.resolve(process.cwd(), destination);
    const relativeTargetDir = path.relative(process.cwd(), absoluteTargetDir) || '.';

    const envData = {
        BOT_PREFIX: botPrefix,
    };

    const localEnvData = {
        MONGO_QUERY_STRING: mongoQueryString,
        SECRET_KEY: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
        DISCORD_TOKEN: discordToken,
        DISCORD_CLIENT_ID: discordClientId,
        DISCORD_CLIENT_SECRET: discordClientSecret,
    };

    try {
        execSync(`npx degit https://github.com/ZumitoTeam/zumito-template.git ${relativeTargetDir}`, {
            stdio: 'inherit'
        });
    } catch (error) {
        alert({
            type: 'error',
            msg: 'Error cloning template',
        });
        throw error;
    }

    if (installDependencies) {
        try {
            execSync('npm install', {
                cwd: absoluteTargetDir,
                stdio: 'inherit'
            });
        } catch (error) {
            alert({
                type: 'error',
                msg: 'Error installing npm dependencies',
            });
            throw error;
        }
    }

    writeEnvFile(path.join(absoluteTargetDir, '.env'), envData);
    writeEnvFile(path.join(absoluteTargetDir, '.env.local'), localEnvData);

    if (showNextSteps) {
        console.log('----------------------------');
        console.log('Project created successfully');
        if (relativeTargetDir !== '.') {
            console.log(`Run "${chalk.blue(`cd ${relativeTargetDir}`)}" to change working directory`);
        }
        console.log(`Run "${chalk.blue("npm run dev")}" to start the bot`);
        console.log(`Run "${chalk.blue("git init && git add -A && git commit -m \"Initial commit\"")}" to initialize git (optional)`);
    }

    return { projectDir: absoluteTargetDir };
};

const writeEnvFile = (filePath, data) => {
    let output = '';
    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
            output += `${key}=${value}\n`;
        }
    });
    fs.writeFileSync(filePath, output);
};

export const project = {
    command: 'project',
    description: 'Create a new project',
    options: projectOptions,
    action: async (params) => {
        await createProject(params);
    }
};
