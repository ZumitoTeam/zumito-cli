import fs from 'fs';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { Project, StructureKind } from 'ts-morph';
import alert from 'cli-alerts';

export const project = {
    command: 'project',
    description: 'Create a new project',
    options: [{
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
    }],
    action: async ({projectName, discordToken, discordClientId, discordClientSecret, botPrefix, mongoQueryString}) => {

        let envData = {
            BOT_PREFIX: botPrefix,
        };

        let localEnvData = {
            MONGO_QUERY_STRING: mongoQueryString,
            SECRET_KEY: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
            DISCORD_TOKEN: discordToken,
            DISCORD_CLIENT_ID: discordClientId,
            DISCORD_CLIENT_SECRET: discordClientSecret,
        }

        // Run git clone in shell
        execSync(`npx degit https://github.com/ZumitoTeam/zumito-template.git ${projectName}`, (err, stdout, stderr) => {
            if (err) {
                alert({
                    type: 'error',
                    msg: 'Error cloning template',
                });
                throw err;
            }
        });
        execSync(`cd ${projectName} && npm install`, (err, stdout, stderr) => {
            if (err) {
                alert({
                    type: 'error',
                    msg: 'Error installing npm dependencies',
                });
                throw err;
            }
        });

        // Generate .env file
        let envOutput = '';
        Object.keys(envData).forEach((key) => {
            if (envData[key] !== undefined && envData[key] !== '')
                envOutput += `${key}=${envData[key]}\n`;
        });
        fs.writeFileSync(`./${projectName}/.env`, envOutput);

        // Generate .env.local file
        let envLocalOutput = '';
        Object.keys(localEnvData).forEach((key) => {
            if (localEnvData[key] !== undefined && localEnvData[key] !== '')
                envLocalOutput += `${key}=${localEnvData[key]}\n`;
        });
        fs.writeFileSync(`./${projectName}/.env.local`, envLocalOutput);
        

        console.log('----------------------------');
        console.log('Project created successfully');
        console.log(`Run "${chalk.blue(`cd ${projectName}`)}" to change working directory`);
        console.log(`Run "${chalk.blue("npm run dev")}" to start the bot`);
        console.log(`Run "${chalk.blue("git init && git add -A && git commit -m \"Initial commit\"")}" to initialize git (optional)`);
    }
}