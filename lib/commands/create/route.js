import fs from 'fs';
import path from 'path';
import { verifyPwd, validateOrCreateModule } from '../../utils/projectStructureValidator.js';
import { Project, StructureKind } from 'ts-morph';
import chalk from 'chalk';
import alert from 'cli-alerts';

export const route = {
    command: "route",
    description: "Generate a web route",
    options: [{
        label: 'Module name',
        type: 'string',
        key: 'moduleName'
    }, {
        label: 'Route name',
        type: 'string',
        key: 'name'
    }],
    action: async ({ moduleName, name }) => {
        validateOrCreateModule(moduleName);

        // Check if routes folder exists
        if (!fs.existsSync(`./src/modules/${moduleName}/routes`)) {
            fs.mkdirSync(`./src/modules/${moduleName}/routes`);
        }

        // Check if route already exists
        if (fs.existsSync(`./src/modules/${moduleName}/routes/${name}.ts`)) {
            console.log('Route with that name already exists in this module');
            return;
        }

        // Capitalize first letter, replace spaces or dashes with camel case
        let routeParsedName = name.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toUpperCase() : word.toUpperCase();
        }).replace(/\s+/g, '').replace(/-/g, '');

        // Create a new project
        const project = new Project();

        // Add a new source file
        const sourceFile = project.createSourceFile(
            path.join("./src", "modules", moduleName, 'routes', `${routeParsedName}.ts`), 
            "", { overwrite: true }
        );

        // Add imports
        sourceFile.addImportDeclaration({
            namedImports: ["Route", "RouteMethod"],
            moduleSpecifier: "zumito-framework",
        });

        // Create the class 'AdminLogin'
        const routeClass = sourceFile.addClass({
            name: routeParsedName,
            extends: "Route",
            isExported: true,
        });

        // Add 'method' property
        routeClass.addProperty({
            name: "method",
            type: "RouteMethod",
            initializer: "RouteMethod.get",
        });

        // Add 'path' property
        routeClass.addProperty({
            name: "path",
            type: "string",
            initializer: "'/example'",
        });

        // Add 'execute' method
        routeClass.addMethod({
            name: "execute",
            parameters: [
                { name: "req", type: "any" },
                { name: "res", type: "any" },
            ],
            statements: "// Your route code goes here",
        });

        // Save the generated file
        await project.save();

        alert({
            type: 'success',
            msg: `Route ${name} created successfully`,
        });
        alert({
            type: 'info',
            msg: `You can find it in src/modules/${moduleName}/routes/${name}.ts`,
        });
    }
};