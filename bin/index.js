#! /usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import pjson from "../package.json" assert { type: "json" };
import alert from 'cli-alerts';
import { Project, StructureKind } from 'ts-morph';
import { search, Separator } from '@inquirer/prompts';
import {project} from '../lib/commands/create/project.js';
import {module} from '../lib/commands/create/module.js';
import {command} from '../lib/commands/create/command.js';
import {event} from '../lib/commands/create/event.js';
import {model} from '../lib/commands/create/model.js';
import {route} from '../lib/commands/create/route.js';


const root = new URL('../', import.meta.url).pathname;

const program = new Command();
program
    .name(pjson.name)
    .description(pjson.description)
    .version(pjson.version);

const groups = [{
    command: "create",
    description: 'Generate elements from a template, Like a project, command, event, etc.',
    commands: [project, module, command, event, model, route]
}]

groups.forEach(group => {
    const groupInstance = program
        .command(group.command)
        .description(group.description);

    group.commands.forEach(command => {
        const commandInstance = groupInstance.command(command.command);
        commandInstance.description(command.description);
        command.options.forEach(option => {
            commandInstance.option(`--${option.key} <${option.key}>`, option.label)
        })
        commandInstance.action(async (params) => {
            for (let option of command.options) {
                if (option.manualParse) continue;
                while (!params[option.key] || !(option.isValid ? option.isValid(params[option.key], option) : true)) {
                    params[option.key] = await inquirer.prompt({
                        type: option.type,
                        name: option.key,
                        message: `${option.label}:`,
                        choices: option.choices
                    }).then((answers) => answers[option.key]);
                }
            }
            command.action(params)
        });
    })
    
})


const addGroup = program
    .command('add')
    .description('Generate elements from a template, Like command methods, etc.');

addGroup.command('commandSelectMenu')
    .description('Add select menu method to a command')
    .option('-c, --command <Command file path>', 'Path to the command file')
    .action(async ({ command }) => {

        const project = new Project();

        // Add your TypeScript file to the project
        const filePath = command;
        const sourceFile = project.addSourceFileAtPath(filePath);

        const classes = sourceFile.getClasses();

        if (classes.length === 0) {
            console.error("No classes found in file.");
            return;
        }

        // Take the first class
        const myClass = classes[0];
        const className = myClass.getName();

        if (!className) {
            console.error("Class name not found.");
            return;
        }

        
        // Add a new method to the class
        myClass.addMethod({
            name: "newMethod",
            statements: `console.log("This is a new method!");`,
        });

        // Save the changes to the file
        sourceFile.save().then(() => {
            console.log("Method added successfully!");
            alert({
                type: 'success',
                msg: `Model created successfully`,
            });
        });

        // Log success
        
    });


program.parse();