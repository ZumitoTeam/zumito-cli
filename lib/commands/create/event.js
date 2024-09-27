import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import { verifyPwd, validateOrCreateModule } from '../../utils/projectStructureValidator.js';
import chalk from 'chalk';
import { Project, StructureKind } from 'ts-morph';
import alert from 'cli-alerts';

export const event = {
    command: "event",
    description: "Generate an event",
    options: [{
        label: 'Module name',
        type: 'string',
        key: 'moduleName'
    }, {
        label: 'Event name',
        type: 'string',
        key: 'name'
    }],
    action: async ({ moduleName, name }) => {

        validateOrCreateModule(moduleName);


        const eventsFolder = path.join('./', 'src', 'modules', moduleName, 'events');

        // Check if events folder exists
        if (!fs.existsSync(eventsFolder)) fs.mkdirSync(eventsFolder);

        // Check if event already exists
        if (fs.existsSync(path.join(eventsFolder, `${name}.ts`))) {
            console.log('Event with that name already exists in this module');
            return;
        }

        // Capitalize first letter, replace spaces or dashes with camel case
        let eventClassName = name.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toUpperCase() : word.toUpperCase();
        }).replace(/\s+/g, '').replace(/-/g, '');

        createEventClass(path.join(eventsFolder, `${name}.ts`));

        // Log success
        alert({
            type: 'success',
            msg: `Event ${name} created successfully`,
        });
        alert({
            type: 'info',
            msg: `You can find it in src/modules/${moduleName}/events/${name}.ts`,
        });
    }
}

export const createEventClass = (path, name) => {
    const project = new Project();
    const sourceFile = project.createSourceFile(path, "", { overwrite: true });

    sourceFile.addImportDeclaration({
        namedImports: ["FrameworkEvent", "EventParameters"],
        moduleSpecifier: "zumito-framework",
    });

    // Define the class name
    const className = name;

    // Add the class declaration
    const eventClass = sourceFile.addClass({
        name: className,
        extends: "FrameworkEvent",
        isExported: true,
    });

    // Add the 'once' property
    eventClass.addProperty({
        name: "once",
        type: "boolean",
        initializer: "false",
    });

    // Add the 'source' property
    eventClass.addProperty({
        name: "source",
        type: "string",
        initializer: "'discord'",
    });

    // Add the execute method
    eventClass.addMethod({
        name: "execute",
        parameters: [
            { name: "params", type: "EventParameters" }
        ],
        returnType: "Promise<void>",
        statements: "// Event code",
    });

    // Save the generated file
    sourceFile.saveSync();
}