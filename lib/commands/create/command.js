import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import { verifyPwd, validateOrCreateModule } from '../../utils/projectStructureValidator.js';
import chalk from 'chalk';
import { Project, StructureKind } from 'ts-morph';
import alert from 'cli-alerts';

export const command = {
    command: "command",
    description: "Generate a command",
    options: [{
        label: 'Module name',
        type: 'string',
        key: 'moduleName'
    }, {
        label: 'Command name',
        type: 'string',
        key: 'name'
    }, {
        label: 'Command type',
        type: 'list',
        choices: ['prefix', 'slash', 'any'],
        key: 'type',
        isValid: (value, option) => {
            return option.choices.includes(value);
        }
    }],
    action: async ({moduleName, name, type}) => {
        validateOrCreateModule(moduleName);

        const commandsFolder = path.join('./', 'src', 'modules', moduleName, 'commands');

        // Check if commands folder exists
        if (!fs.existsSync(commandsFolder)) fs.mkdirSync(commandsFolder);

        // Check if command already exists
        if (fs.existsSync(path.join(commandsFolder, `${name}.ts`))) {
            console.log('Command with that name already exists');
            return;
        }

        // Capitalize first letter, replace spaces or dashes with camel case
        let commandClassName = name.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toUpperCase() : word.toUpperCase();
        }).replace(/\s+/g, '').replace(/-/g, '');

        createCommandClass(path.join(commandsFolder, `${name}.ts`), commandClassName, type);

        // Log success
        alert({
            type: 'success',
            msg: `Command ${name} created successfully`,
        });
        alert({
            type: 'info',
            msg: `You can find it in src/modules/${moduleName}/commands/${name}.ts`,
        });
    }
};

function createCommandClass(filePath, name, type) {
    const project = new Project();
    const sourceFile = project.createSourceFile(filePath, "", { overwrite: true });

    sourceFile.addImportDeclaration({
        namedImports: ["Command", "CommandParameters", "CommandType"],
        moduleSpecifier: "zumito-framework",
    });

    // Define the class name
    const className = name.charAt(0).toUpperCase() + name.slice(1);

    // Add the class declaration
    const commandClass = sourceFile.addClass({
        name: className,
        extends: "Command",
        isExported: true,
    });

    // Add the 'type' property
    commandClass.addProperty({
        name: "type",
        type: `CommandType.${type}`,
        initializer: `CommandType.${type}`,
    });

    // Add the constructor
    commandClass.addConstructor({
        statements: "// Here you can import required services from ServiceContainer",
    });

    // Add the execute method
    commandClass.addMethod({
        name: "execute",
        parameters: [
            { name: "params", type: "CommandParameters" }
        ],
        returnType: "void",
        statements: "// Here you can do your stuff when command is runned",
    });

    sourceFile.saveSync();
}

