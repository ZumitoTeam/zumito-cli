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
        label: 'Database type',
        type: 'string',
        key: 'databaseType',
        manualParse: true,
    },
    {
        label: 'Database host',
        type: 'string',
        key: 'databaseHost',
        manualParse: true,
    },
    {
        label: 'Database port',
        type: 'string',
        key: 'databasePort',
        manualParse: true,
    },
    {
        label: 'Database name',
        type: 'string',
        key: 'databaseName',
        manualParse: true,
    },
    {
        label: 'Database user',
        type: 'string',
        key: 'databaseUser',
        manualParse: true,
    },
    {
        label: 'Database password',
        type: 'string',
        key: 'databasePassword',
        manualParse: true,
    }],
    action: async ({projectName, discordToken, discordClientId, discordClientSecret, botPrefix, databaseType, databaseHost, databasePort, databaseName, databaseUser, databasePassword}) => {

        if (!databaseType) databaseType = await inquirer.prompt({
            type: 'list',
            name: 'databaseType',
            message: 'Database type: (tingodb is recommended for development) (mongodb is recommended for production)',
            choices: ['sqlite', 'mysql', 'postgres', 'mongodb', 'tingodb', 'couchdb'],
        }).then((answers) => answers.databaseType);
        if (!databaseType !== 'sqlite' && databaseType !== 'tingodb') {
            if (!databaseHost) databaseHost = await inquirer.prompt({
                type: 'input',
                name: 'databaseHost',
                message: 'Database host:',
                default: 'localhost',
            }).then((answers) => answers.databaseHost);
            if (!databasePort) databasePort = await inquirer.prompt({
                type: 'input',
                name: 'databasePort',
                message: 'Database port:',
                default: databaseType === 'mysql' ? '3306' : databaseType === 'postgres' ? '5432' : databaseType === 'mongodb' ? '27017' : databaseType === 'couchdb' ? '5984' : '',
            }).then((answers) => answers.databasePort);
            if (!databaseName) databaseName = await inquirer.prompt({
                type: 'input',
                name: 'databaseName',
                message: 'Database name:',
            }).then((answers) => answers.databaseName);
            if (!databaseUser) databaseUser = await inquirer.prompt({
                type: 'input',
                name: 'databaseUser',
                message: 'Database user:',
            }).then((answers) => answers.databaseUser);
            if (!databasePassword) databasePassword = await inquirer.prompt({
                type: 'input',
                name: 'databasePassword',
                message: 'Database password:',
            }).then((answers) => answers.databasePassword);
        }

        let envData = {
            BOT_PREFIX: botPrefix,
        };

        let localEnvData = {
            DATABASE_TYPE: databaseType,
            DATABASE_HOST: databaseHost,
            DATABASE_PORT: databasePort,
            DATABASE_NAME: databaseName,
            DATABASE_USER: databaseUser,
            DATABASE_PASSWORD: databasePassword,
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