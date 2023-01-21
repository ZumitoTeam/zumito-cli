#! /usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import pjson from "../package.json" assert { type: "json" };
import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';
import ejs from 'ejs';

const root = new URL('../', import.meta.url).pathname;

const program = new Command();
program
    .name(pjson.name)
    .description(pjson.description)
    .version(pjson.version);

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
                        name: 'MONGOURI',
                        message: 'MongoDB connection string:',
                    }, {
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
                    }
                ]);
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
                console.log(`Run "${chalk.blue("npm run start")}" to start the bot`);
                console.log(`Run "${chalk.blue("git init && git add -A && git commit -m \"Initial commit\"")}" to initialize git`);
                break;
            }
            case 'module': {
                // check if src/modules exists
                if (!fs.existsSync('./src/modules')) {
                    console.log('src/modules folder does not exist. Verify that you are in the root of your project');
                    return;
                }
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
                fs.mkdirSync(`./src/modules/${moduleName}`);
                // create module default folders
                let folders = ['commands', 'events', 'translations'];
                folders.forEach((folder) => {
                    fs.mkdirSync(`./src/modules/${moduleName}/${folder}`);
                });

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
                break;
            }
            case 'event': {
                // TODO
                console.log('Not implemented yet');
                break;
            }
            default: {
                console.log('Invalid type');
                console.log('Valid types: project, module, command, event');
                break;
            }
        }
    });
program.parse();