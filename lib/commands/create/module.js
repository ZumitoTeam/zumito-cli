import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { Project, StructureKind } from 'ts-morph';
import { verifyPwd, validateOrCreateModule } from '../../utils/projectStructureValidator.js';
import alert from 'cli-alerts';

export const module = {
    command: "module",
    description: "Generate a module",
    options: [{
        label: 'Module name',
        type: 'string',
        key: 'name'
    }, {
        label: 'Module type',
        type: 'list',
        choices: ['common', 'custom_behavior'],
        key: 'type',
        isValid: (value, option) => {
            return option.choices.includes(value);
        }
    }],
    action: async ({name, type}) => {
        // check if src/modules exists
        verifyPwd();

        // create module folder
        validateOrCreateModule(name);

        // Check if module type is custom behavior and create index.ts
        if (type === 'custom_behavior') {
            // Capitalize first letter, replace spaces or dashes with camel case
            let moduleClassName = name.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index === 0 ? word.toUpperCase() : word.toUpperCase();
            }).replace(/\s+/g, '').replace(/-/g, '');

            createModuleClass(path.join('./', 'src', 'modules', name, `index.ts`), moduleClassName)
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
    }
}

function createModuleClass(filePath, name) {
    const project = new Project();
    const sourceFile = project.createSourceFile(filePath, "", { overwrite: true });

    // Define the class name
    const className = `${name.charAt(0).toUpperCase() + name.slice(1)}Module`; // Capitalize the first letter and append 'Module'

    sourceFile.addImportDeclaration({
        namedImports: ["Module"],
        moduleSpecifier: "zumito-framework",
    });

    // Add the class declaration
    const moduleClass = sourceFile.addClass({
        name: className,
        extends: "Module",
        isExported: true,
    });

    // Add the constructor
    moduleClass.addConstructor({
        parameters: [{ name: "modulePath", type: "string" }],
        statements: [
            "super(modulePath);",
            "// Code executed on module initialization"
        ],
    });

    // Save the generated file
    sourceFile.saveSync();
}