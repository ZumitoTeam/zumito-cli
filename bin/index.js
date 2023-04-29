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
    .argument('[projectName]', 'Project name')
    .argument('[token]', 'Discord bot token')
    .argument('[clientId]', 'Discord client ID')
    .argument('[clientSecret]', 'Discord client secret')
    .argument('[botPrefix]', 'Default prefix')
    .argument('[databaseType]', 'Database type')
    .argument('[databaseHost]', 'Database host')
    .argument('[databasePort]', 'Database port')
    .argument('[databaseName]', 'Database name')
    .argument('[databaseUser]', 'Database user')
    .argument('[databasePassword]', 'Database password')
    .action(async (projectName, token, clientId, clientSecret, botPrefix, databaseType, databaseHost, databasePort, databaseName, databaseUser, databasePassword) => {
        if (!projectName) projectName = await inquirer.prompt({
            type: 'input',
            name: 'projectName',
            message: 'Project name:',
        }).then((answers) => answers.projectName);
        if (!token) token = await inquirer.prompt({
            type: 'input',
            name: 'token',
            message: 'Discord bot token:',
        }).then((answers) => answers.token);
        if (!clientId) clientId = await inquirer.prompt({
            type: 'input',
            name: 'clientId',
            message: 'Discord client ID:',
        }).then((answers) => answers.clientId);
        if (!clientSecret) clientSecret = await inquirer.prompt({
            type: 'input',
            name: 'clientSecret',
            message: 'Discord client secret:',
        }).then((answers) => answers.clientSecret);
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
            DISCORD_TOKEN: token,
            DISCORD_CLIENT_ID: clientId,
            DISCORD_CLIENT_SECRET: clientSecret,
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
    .argument('[moduleName]', 'Module name')
    .argument('[moduleType]', 'Module type')
    .action(async (moduleName, moduleType) => {
        // check if src/modules exists
        verifyPwd();

        // verify and ask for parameters
        if (!moduleName) moduleName = await inquirer.prompt({
            type: 'input',
            name: 'moduleName',
            message: 'Module name:',
        }).then((answers) => answers.moduleName);
        if (!moduleType || !['common', 'custom_behavior'].includes(moduleType)) moduleType = await inquirer.prompt({
            type: 'list',
            name: 'type',
            message: 'Module type:',
            choices: ['common', 'custom_behavior'],
        }).then((answers) => answers.type);

        // create module folder
        validateOrCreateModule(moduleName);

        // Check if module type is custom behavior and create index.ts
        if (moduleType === 'custom_behavior') {
            // Capitalize first letter, replace spaces or dashes with camel case
            let moduleClassName = moduleName.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index === 0 ? word.toUpperCase() : word.toUpperCase();
            }).replace(/\s+/g, '').replace(/-/g, '');
            // Load template
            let template = fs.readFileSync(root + '/templates/module.ts.ejs', 'utf8');
            let templateOutput = ejs.render(template, {
                name: moduleClassName,
            });
            // Write file
            fs.writeFileSync(`./src/modules/${moduleName}/index.ts`, templateOutput);
        }
        console.log(`Module ${chalk.blue(moduleName)} created ${chalk.green('successfully')}`);
        alert({
            type: 'success',
            msg: `Module ${moduleName} created successfully`,
        });
        alert({
            type: 'info',
            msg: `You can find it in src/modules/${moduleName}`,
        });
    });

createGroup.command('command')
    .description('Generate a command')
    .argument('[moduleName]', 'Module name')
    .argument('[commandName]', 'Command name')
    .action(async (moduleName, commandName) => {
        if (!moduleName) moduleName = await inquirer.prompt({
            type: 'input',
            name: 'moduleName',
            message: 'Module name:',
        }).then((answers) => answers.moduleName);
        if (!commandName) commandName = await inquirer.prompt({
            type: 'input',
            name: 'commandName',
            message: 'Command name:',
        }).then((answers) => answers.commandName);

        validateOrCreateModule(moduleName);

        // Check if commands folder exists
        if (!fs.existsSync(`./src/modules/${moduleName}/commands`)) {
            fs.mkdirSync(`./src/modules/${moduleName}/commands`);
        }

        // Check if command already exists
        if (fs.existsSync(`./src/modules/${moduleName}/commands/${commandName}.ts`)) {
            console.log('Command with that name already exists');
            return;
        }

        // Capitalize first letter, replace spaces or dashes with camel case
        let commandClassName = commandName.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toUpperCase() : word.toUpperCase();
        }).replace(/\s+/g, '').replace(/-/g, '');
        // Load template
        let template = fs.readFileSync(root + '/templates/command.ts.ejs', 'utf8');
        let templateOutput = ejs.render(template, {
            name: commandClassName,
        });
        // Write file
        fs.writeFileSync(`./src/modules/${moduleName}/commands/${commandName}.ts`, templateOutput);

        // Log success
        alert({
            type: 'success',
            msg: `Command ${commandName} created successfully`,
        });
        alert({
            type: 'info',
            msg: `You can find it in src/modules/${moduleName}/commands/${commandName}.ts`,
        });
    });

createGroup.command('event')
    .description('Generate an event')
    .argument('[moduleName]', 'Module name')
    .argument('[eventName]', 'Event name')
    .action(async (moduleName, eventName) => {
        if (!moduleName) moduleName = await inquirer.prompt({
            type: 'input',
            name: 'moduleName',
            message: 'Module name:',
        }).then((answers) => answers.moduleName);
        if (!eventName) eventName = await inquirer.prompt({
            type: 'input',
            name: 'eventName',
            message: 'Event name:',
        }).then((answers) => answers.eventName);
        if (eventName === 'other') {
            eventName = await inquirer.prompt({
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
        if (fs.existsSync(`./src/modules/${moduleName}/events/${eventName}.ts`)) {
            console.log('Event with that name already exists in this module');
            return;
        }

        // Capitalize first letter, replace spaces or dashes with camel case
        let eventClassName = eventName.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toUpperCase() : word.toUpperCase();
        }).replace(/\s+/g, '').replace(/-/g, '');
        // Load template
        let template = fs.readFileSync(root + '/templates/event.ts.ejs', 'utf8');
        let templateOutput = ejs.render(template, {
            name: eventClassName,
        });
        // Write file
        fs.writeFileSync(`./src/modules/${moduleName}/events/${eventName}.ts`, templateOutput);

        // Log success
        alert({
            type: 'success',
            msg: `Event ${eventName} created successfully`,
        });
        alert({
            type: 'info',
            msg: `You can find it in src/modules/${moduleName}/events/${eventName}.ts`,
        });
    });

createGroup.command('model')
    .description('Generate a database model')
    .argument('[moduleName]', 'Module name')
    .argument('[modelName]', 'Model name')
    .action(async (moduleName, modelName) => {
        if (!moduleName) moduleName = await inquirer.prompt({
            type: 'input',
            name: 'moduleName',
            message: 'Module name:',
        }).then((answers) => answers.moduleName);
        if (!modelName) modelName = await inquirer.prompt({
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
        if (fs.existsSync(`./src/modules/${moduleName}/models/${modelName}.ts`)) {
            console.log('Model with that name already exists in this module');
            return;
        }

        // Capitalize first letter, replace spaces or dashes with camel case
        let modelParsedName = modelName.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toUpperCase() : word.toUpperCase();
        }).replace(/\s+/g, '').replace(/-/g, '');

        // Load template
        let template = fs.readFileSync(root + '/templates/model.ts.ejs', 'utf8');
        let templateOutput = ejs.render(template, {
            name: modelParsedName,
        });
        // Write file
        fs.writeFileSync(`./src/modules/${moduleName}/models/${modelName}.ts`, templateOutput);

        // Log success
        alert({
            type: 'success',
            msg: `Model ${modelName} created successfully`,
        });
        alert({
            type: 'info',
            msg: `You can find it in src/modules/${moduleName}/models/${modelName}.ts`,
        });
    });

program.parse();