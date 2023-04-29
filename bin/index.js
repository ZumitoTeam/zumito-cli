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

program.command('create')
    .description('Generate elements from a template, Like a project, command, event, etc.')
    .argument('<type>', 'Thing you want to create. Ex: project, command, event, etc.')
    .action(async (name) => {
        switch (name) {
            case 'project': {
                const projectName = await inquirer.prompt({
                    type: 'input',
                    name: 'name',
                    message: 'Project name:',
                }).then((answers) => answers.name);
                let envData = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'TOKEN',
                        message: 'Discord bot token:',
                    }, {
                        type: 'input',
                        name: 'CLIENT_ID',
                        message: 'Discord client ID:',
                    }, {
                        type: 'input',
                        name: 'CLIENT_SECRET',
                        message: 'Discord client secret:',
                    }, {
                        type: 'input',
                        name: 'BOTPREFIX',
                        message: 'Default prefix:',
                    }, {
                        type: 'list',
                        name: 'DATABASE_TYPE',
                        message: 'Database type: (tingodb is recommended for development) (mongodb is recommended for production)',
                        choices: ['sqlite', 'mysql', 'postgres', 'mongodb', 'tingodb', 'couchdb'],

                    }
                ]);
                if (envData.DATABASE_TYPE === 'mysql' || envData.DATABASE_TYPE === 'postgres') {
                    // Combine envData wit new prompt
                    envData = Object.assign(envData, await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'DATABASE_HOST',
                            message: 'Database host:',
                            default: 'localhost',
                        }, {
                            type: 'input',
                            name: 'DATABASE_PORT',
                            message: 'Database port:',
                            default: envData.DATABASE_TYPE === 'mysql' ? 3306 : 5432,
                        }, {
                            type: 'input',
                            name: 'DATABASE_NAME',
                            message: 'Database name:',
                            default: 'zumito',
                        }, {
                            type: 'input',
                            name: 'DATABASE_USER',
                            message: 'Database user:',
                            default: 'root',
                        }, {
                            type: 'input',
                            name: 'DATABASE_PASSWORD',
                            message: 'Database password:',
                        }
                    ]));
                } else if (envData.DATABASE_TYPE === 'mongodb') {
                    // Combine envData wit new prompt
                    envData = Object.assign(envData, await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'DATABASE_HOST',
                            message: 'Database host:',
                            default: 'localhost',
                        }, {
                            type: 'input',
                            name: 'DATABASE_PORT',
                            message: 'Database port:',
                            default: 27017,
                        }, {
                            type: 'input',
                            name: 'DATABASE_NAME',
                            message: 'Database name:',
                            default: 'zumito',
                        }, {
                            type: 'input',
                            name: 'DATABASE_USER',
                            message: 'Database user:',
                            default: 'root',
                        }, {
                            type: 'input',
                            name: 'DATABASE_PASSWORD',
                            message: 'Database password:',
                        }
                    ]));
                }
                envData.SECRET_KEY = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

                // Run git clone in shell
                execSync(`git clone https://github.com/ZumitoTeam/zumito-template.git ${projectName}`, (err, stdout, stderr) => {
                    if (err) {
                        console.log('Error cloning the repository');
                        throw err;
                    }
                });
                execSync(`cd ${projectName} && npm install`, (err, stdout, stderr) => {
                    if (err) {
                        console.log('Error installing dependencies');
                        throw err;
                    }
                });

                // Generate .env file
                let envOutput = '';
                Object.keys(envData).forEach((key) => {
                    envOutput += `${key}=${envData[key]}\n`;
                });
                fs.writeFileSync(`./${projectName}/.env`, envOutput);

                console.log('----------------------------');
                console.log('Project created successfully');
                console.log(`Run "${chalk.blue(`cd ${projectName}`)}" to change working directory`);
                console.log(`Run "${chalk.blue("npm run dev")}" to start the bot`);
                console.log(`Run "${chalk.blue("git init && git add -A && git commit -m \"Initial commit\"")}" to initialize git (optional)`);
                break;
            }
            case 'module': {
                // check if src/modules exists
                verifyPwd();

                const moduleName = await inquirer.prompt({
                    type: 'input',
                    name: 'name',
                    message: 'Module name:',
                }).then((answers) => answers.name);
                const moduleType = await inquirer.prompt({
                    type: 'list',
                    name: 'type',
                    message: 'Module type:',
                    choices: ['common', 'custom behavior'],
                }).then((answers) => answers.type);
                // check if module already exists
                if (fs.existsSync(`./src/modules/${moduleName}`)) {
                    console.log('Module with that name already exists');
                    return;
                }

                // create module folder
                validateOrCreateModule(moduleName);

                // Check if module type is custom behavior and create index.ts
                if (moduleType === 'custom behavior') {
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
                break;
            }
            case 'command': {
                const moduleName = await inquirer.prompt({
                    type: 'input',
                    name: 'name',
                    message: 'Module name:',
                }).then((answers) => answers.name);
                const commandName = await inquirer.prompt({
                    type: 'input',
                    name: 'name',
                    message: 'Command name:',
                }).then((answers) => answers.name);
                
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
                console.log(`Command ${chalk.blue(commandName)} created ${chalk.green('successfully')}`);
                // Log file path
                console.log(`File path: ${chalk.blue(`./src/modules/${moduleName}/commands/${commandName}.ts`)}`);
                break;
            }
            case 'event': {
                const moduleName = await inquirer.prompt({
                    type: 'input',
                    name: 'name',
                    message: 'Module name:',
                }).then((answers) => answers.name);
                // Ask for event name, show this list of events (messageCreate, interactionCreate, load) and allow to write custom event
                let eventName = await inquirer.prompt({
                    type: 'list',
                    name: 'name',
                    message: 'Event name:',
                    choices: ['messageCreate', 'interactionCreate', 'load', 'other'],
                    validate: function(answer) {
                        if (answer.trim() === '') {
                          return 'Please enter a value';
                        } else {
                            return true;
                        }
                    }
                }).then((answers) => answers.name);
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
                console.log(`Event ${chalk.blue(eventName)} created ${chalk.green('successfully')}`);
                // Log file path
                console.log(`File path: ${chalk.blue(`./src/modules/${moduleName}/events/${eventName}.ts`)}`);
                break;

            }
            case 'model': {
                const moduleName = await inquirer.prompt({
                    type: 'input',
                    name: 'name',
                    message: 'Module name:',
                }).then((answers) => answers.name);
                const modelName = await inquirer.prompt({
                    type: 'input',
                    name: 'name',
                    message: 'Model name: (CamelCase)',
                }).then((answers) => answers.name);

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
                console.log(`Model ${chalk.blue(modelName)} created ${chalk.green('successfully')}`);
                // log file path
                console.log(`File path: ${chalk.blue(`./src/modules/${moduleName}/models/${modelName}.ts`)}`);
                break;
            }
            default: {
                alert({
                    type: 'error',
                    name: 'Invalid type',
                    msg: 'A valid type is required to proceed',
                })
                alert({
                    type: 'info',
                    msg: 'Valid types: project, module, command, event, model',
                });
                break;
            }
        }
    });
program.parse();