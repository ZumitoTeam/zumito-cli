#! /usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import pjson from "../package.json" assert { type: "json" };
import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';
import ejs from 'ejs';
import alert from 'cli-alerts';

const root = new URL('../', import.meta.url).pathname;

const program = new Command();
program
    .name(pjson.name)
    .description(pjson.description)
    .version(pjson.version);

function verifyPwd() {
    if (!fs.existsSync('./src/modules')) {
        alert({
            type: 'error',
            msg: 'src/modules folder does not exist.',
        });
        alert({
            type: 'warning',
            msg: 'Are you running this command in the root folder of your project?',
        });
        process.exit(1);
    }
}

function validateOrCreateModule(moduleName) {

    // check if src/modules exists
    verifyPwd();

    // Check if module exists
    if (!fs.existsSync(`./src/modules/${moduleName}`)) {
        // create module folder
        fs.mkdirSync(`./src/modules/${moduleName}`);
        // create module default folders
        let folders = ['commands', 'events', 'translations'];
        folders.forEach((folder) => {
            fs.mkdirSync(`./src/modules/${moduleName}/${folder}`);
        });
    }
}

const createGroup = program
    .command('create')
    .description('Generate elements from a template, Like a project, command, event, etc.')

createGroup.command('project')
    .description('Create a new project')
    .option('--projectName <projectName>', 'Project name')
    .option('--discordToken <discordToken>', 'Discord bot token')
    .option('--discordClientId <discordClientId>', 'Discord client ID')
    .option('--discordClientSecret <discordClientSecret>', 'Discord client secret')
    .option('--botPrefix <botPrefix>', 'Default prefix')
    .option('--databaseType <databaseType>', 'Database type')
    .option('--databaseHost <databaseHost>', 'Database host')
    .option('--databasePort <databasePort>', 'Database port')
    .option('--databaseName <databaseName>', 'Database name')
    .option('--databaseUser <databaseUser>', 'Database user')
    .option('--databasePassword <databasePassword>', 'Database password')
    .action(async ({projectName, discordToken, discordClientId, discordClientSecret, botPrefix, databaseType, databaseHost, databasePort, databaseName, databaseUser, databasePassword}) => {
        if (!projectName) projectName = await inquirer.prompt({
            type: 'input',
            name: 'projectName',
            message: 'Project name:',
        }).then((answers) => answers.projectName);
        if (!discordToken) discordToken = await inquirer.prompt({
            type: 'input',
            name: 'discordToken',
            message: 'Discord bot token:',
        }).then((answers) => answers.discordToken);
        if (!discordClientId) discordClientId = await inquirer.prompt({
            type: 'input',
            name: 'discordClientId',
            message: 'Discord client ID:',
        }).then((answers) => answers.discordClientId);
        if (!discordClientSecret) discordClientSecret = await inquirer.prompt({
            type: 'input',
            name: 'discordClientSecret',
            message: 'Discord client secret:',
        }).then((answers) => answers.discordClientSecret);
        if (!botPrefix) botPrefix = await inquirer.prompt({
            type: 'input',
            name: 'botPrefix',
            message: 'Default prefix:',
        }).then((answers) => answers.botPrefix);
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
            SECRET_KEY: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
            DISCORD_TOKEN: discordToken,
            DISCORD_CLIENT_ID: discordClientId,
            DISCORD_CLIENT_SECRET: discordClientSecret,
            BOT_PREFIX: botPrefix,
            DATABASE_TYPE: databaseType,
            DATABASE_HOST: databaseHost,
            DATABASE_PORT: databasePort,
            DATABASE_NAME: databaseName,
            DATABASE_USER: databaseUser,
            DATABASE_PASSWORD: databasePassword,
        };

        // Run git clone in shell
        execSync(`git clone https://github.com/ZumitoTeam/zumito-template.git ${projectName}`, (err, stdout, stderr) => {
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
        fs.rmdirSync(`./${projectName}/.git`, { recursive: true });

        // Generate .env file
        let envOutput = '';
        Object.keys(envData).forEach((key) => {
            if (envData[key] !== undefined && envData[key] !== '')
            envOutput += `${key}=${envData[key]}\n`;
        });
        fs.writeFileSync(`./${projectName}/.env`, envOutput);

        console.log('----------------------------');
        console.log('Project created successfully');
        console.log(`Run "${chalk.blue(`cd ${projectName}`)}" to change working directory`);
        console.log(`Run "${chalk.blue("npm run dev")}" to start the bot`);
        console.log(`Run "${chalk.blue("git init && git add -A && git commit -m \"Initial commit\"")}" to initialize git (optional)`);
    });

createGroup.command('module')
    .description('Generate a module')
    .option('-n, --name <name>', 'Module name')
    .option('-t, --type <type>', 'Module type')
    .action(async ({name, type}) => {
        // check if src/modules exists
        verifyPwd();

        // verify and ask for parameters
        if (!name) name = await inquirer.prompt({
            type: 'input',
            name: 'moduleName',
            message: 'Module name:',
        }).then((answers) => answers.moduleName);
        if (!type || !['common', 'custom_behavior'].includes(type)) type = await inquirer.prompt({
            type: 'list',
            name: 'type',
            message: 'Module type:',
            choices: ['common', 'custom_behavior'],
        }).then((answers) => answers.type);

        // create module folder
        validateOrCreateModule(name);

        // Check if module type is custom behavior and create index.ts
        if (type === 'custom_behavior') {
            // Capitalize first letter, replace spaces or dashes with camel case
            let moduleClassName = name.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index === 0 ? word.toUpperCase() : word.toUpperCase();
            }).replace(/\s+/g, '').replace(/-/g, '');
            // Load template
            let template = fs.readFileSync(root + '/templates/module.ts.ejs', 'utf8');
            let templateOutput = ejs.render(template, {
                name: moduleClassName,
            });
            // Write file
            fs.writeFileSync(`./src/modules/${name}/index.ts`, templateOutput);
        }
        console.log(`Module ${chalk.blue(name)} created ${chalk.green('successfully')}`);
        alert({
            type: 'success',
            msg: `Module ${name} created successfully`,
        });
        alert({
            type: 'info',
            msg: `You can find it in src/modules/${name}`,
        });
    });

createGroup.command('command')
    .description('Generate a command')
    .option('-m, --moduleName <moduleName>', 'Module name')
    .option('-n, --name <name>', 'Command name')
    .option('-t, --type <type>', 'Command type')
    .action(async ({moduleName, name, type}) => {
        if (!moduleName) moduleName = await inquirer.prompt({
            type: 'input',
            name: 'moduleName',
            message: 'Module name:',
        }).then((answers) => answers.moduleName);
        if (!name) name = await inquirer.prompt({
            type: 'input',
            name: 'name',
            message: 'Command name:',
        }).then((answers) => answers.name);
        const commandTypes = ['prefix', 'slash', 'any'];
        if (!type || !commandTypes.includes(type)) type = await inquirer.prompt({
            type: 'list',
            name: 'type',
            message: 'Command type:',
            choices: commandTypes,
        }).then((answers) => answers.type);

        validateOrCreateModule(moduleName);

        // Check if commands folder exists
        if (!fs.existsSync(`./src/modules/${moduleName}/commands`)) {
            fs.mkdirSync(`./src/modules/${moduleName}/commands`);
        }

        // Check if command already exists
        if (fs.existsSync(`./src/modules/${moduleName}/commands/${name}.ts`)) {
            console.log('Command with that name already exists');
            return;
        }

        // Capitalize first letter, replace spaces or dashes with camel case
        let commandClassName = name.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toUpperCase() : word.toUpperCase();
        }).replace(/\s+/g, '').replace(/-/g, '');
        // Load template
        let template = fs.readFileSync(root + '/templates/command.ts.ejs', 'utf8');
        let templateOutput = ejs.render(template, {
            name: commandClassName,
            type,
        });
        // Write file
        fs.writeFileSync(`./src/modules/${moduleName}/commands/${name}.ts`, templateOutput);

        // Log success
        alert({
            type: 'success',
            msg: `Command ${name} created successfully`,
        });
        alert({
            type: 'info',
            msg: `You can find it in src/modules/${moduleName}/commands/${name}.ts`,
        });
    });

createGroup.command('event')
    .description('Generate an event')
    .option('-m, --moduleName <moduleName>', 'Module name')
    .option('-n, --name <name>', 'Event name')
    .action(async ({ moduleName, name }) => {
        if (!moduleName) moduleName = await inquirer.prompt({
            type: 'input',
            name: 'moduleName',
            message: 'Module name:',
        }).then((answers) => answers.moduleName);
        if (!name) name = await inquirer.prompt({
            type: 'input',
            name: 'eventName',
            message: 'Event name:',
        }).then((answers) => answers.eventName);
        if (name === 'other') {
            name = await inquirer.prompt({
                type: 'input',
                name: 'name',
                message: 'Event name:',
            }).then((answers) => answers.name);
        }
        
        validateOrCreateModule(moduleName);


        // Check if events folder exists
        if (!fs.existsSync(`./src/modules/${moduleName}/events`)) {
            fs.mkdirSync(`./src/modules/${moduleName}/events`);
        }

        // Check if event already exists
        if (fs.existsSync(`./src/modules/${moduleName}/events/${name}.ts`)) {
            console.log('Event with that name already exists in this module');
            return;
        }

        // Capitalize first letter, replace spaces or dashes with camel case
        let eventClassName = name.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toUpperCase() : word.toUpperCase();
        }).replace(/\s+/g, '').replace(/-/g, '');
        // Load template
        let template = fs.readFileSync(root + '/templates/event.ts.ejs', 'utf8');
        let templateOutput = ejs.render(template, {
            name: eventClassName,
        });
        // Write file
        fs.writeFileSync(`./src/modules/${moduleName}/events/${name}.ts`, templateOutput);

        // Log success
        alert({
            type: 'success',
            msg: `Event ${name} created successfully`,
        });
        alert({
            type: 'info',
            msg: `You can find it in src/modules/${moduleName}/events/${name}.ts`,
        });
    });

createGroup.command('model')
    .description('Generate a database model')
    .option('-m, --moduleName <moduleName>', 'Module name')
    .option('-n, --name <name>', 'Model name')
    .action(async ({ moduleName, name }) => {
        if (!moduleName) moduleName = await inquirer.prompt({
            type: 'input',
            name: 'moduleName',
            message: 'Module name:',
        }).then((answers) => answers.moduleName);
        if (!name) name = await inquirer.prompt({
            type: 'input',
            name: 'modelName',
            message: 'Model name:',
        }).then((answers) => answers.modelName);
        
        validateOrCreateModule(moduleName);

        // Check if models folder exists
        if (!fs.existsSync(`./src/modules/${moduleName}/models`)) {
            fs.mkdirSync(`./src/modules/${moduleName}/models`);
        }

        // Check if model already exists
        if (fs.existsSync(`./src/modules/${moduleName}/models/${name}.ts`)) {
            console.log('Model with that name already exists in this module');
            return;
        }

        // Capitalize first letter, replace spaces or dashes with camel case
        let modelParsedName = name.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toUpperCase() : word.toUpperCase();
        }).replace(/\s+/g, '').replace(/-/g, '');

        // Load template
        let template = fs.readFileSync(root + '/templates/model.ts.ejs', 'utf8');
        let templateOutput = ejs.render(template, {
            name: modelParsedName,
        });
        // Write file
        fs.writeFileSync(`./src/modules/${moduleName}/models/${name}.ts`, templateOutput);

        // Log success
        alert({
            type: 'success',
            msg: `Model ${name} created successfully`,
        });
        alert({
            type: 'info',
            msg: `You can find it in src/modules/${moduleName}/models/${name}.ts`,
        });
    });

program.parse();