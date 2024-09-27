import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import { verifyPwd, validateOrCreateModule } from '../../utils/projectStructureValidator.js';
import chalk from 'chalk';
import { Project, StructureKind } from 'ts-morph';
import alert from 'cli-alerts';

export const model = {
    command: "model",
    description: "Generate a database model",
    options: [{
        label: 'Module name',
        type: 'string',
        key: 'moduleName'
    }, {
        label: 'Model name',
        type: 'string',
        key: 'name'
    }],
    action: async ({ moduleName, name }) => {
        validateOrCreateModule(moduleName);

        const modelsFolder = path.join('./', 'src', 'modules', moduleName, 'models');

        // Check if models folder exists
        if (!fs.existsSync(modelsFolder)) fs.mkdirSync(modelsFolder);

        // Check if model already exists
        if (fs.existsSync(path.join(modelsFolder, `${name}.ts`))) {
            console.log('Model with that name already exists in this module');
            return;
        }

        // Capitalize first letter, replace spaces or dashes with camel case
        let modelParsedName = name.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toUpperCase() : word.toUpperCase();
        }).replace(/\s+/g, '').replace(/-/g, '');

        createDatabaseModelClass(path.join(modelsFolder, `${name}.ts`), name);

        // Log success
        alert({
            type: 'success',
            msg: `Model ${name} created successfully`,
        });
        alert({
            type: 'info',
            msg: `You can find it in src/modules/${moduleName}/models/${name}.ts`,
        });
    }
};

function createDatabaseModelClass(filePath, name) {
    const project = new Project();
    const sourceFile = project.createSourceFile(filePath, "", { overwrite: true });

    sourceFile.addImportDeclaration({
        namedImports: ["DatabaseModel"],
        moduleSpecifier: "zumito-framework",
    });

    // Define the class name
    const className = name.charAt(0).toUpperCase() + name.slice(1); // Capitalize the first letter

    // Add the class declaration
    const modelClass = sourceFile.addClass({
        name: className,
        extends: "DatabaseModel",
        isExported: true,
    });

    // Add the getModel method
    modelClass.addMethod({
        name: "getModel",
        parameters: [
            { name: "schema", type: "any" }
        ],
        returnType: "any",
        statements: "// Return the model definition\nreturn {\n\n};",
    });

    // Add the define method
    modelClass.addMethod({
        name: "define",
        parameters: [
            { name: "model", type: "any" },
            { name: "models", type: "any" }
        ],
        returnType: "void",
        statements: "// Register model validations, relationships and methods.",
    });

    // Save the generated file
    sourceFile.saveSync();
}