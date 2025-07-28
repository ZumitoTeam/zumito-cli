import fs from 'fs';
import path from 'path';
import { Project, Scope } from 'ts-morph';
import { validateOrCreateModule } from '../../utils/projectStructureValidator.js';
import alert from 'cli-alerts';

export const actionRowBuilder = {
    command: 'actionRowBuilder',
    description: 'Generate an action row builder service',
    options: [{
        label: 'Module name',
        type: 'string',
        key: 'moduleName'
    }, {
        label: 'Service name',
        type: 'string',
        key: 'name'
    }],
    action: async ({ moduleName, name }) => {
        validateOrCreateModule(moduleName);

        const rowsFolder = path.join('./', 'src', 'modules', moduleName, 'services', 'actionRows');

        if (!fs.existsSync(rowsFolder)) {
            fs.mkdirSync(rowsFolder, { recursive: true });
        }

        const filePath = path.join(rowsFolder, `${name}ActionRowBuilder.ts`);
        if (fs.existsSync(filePath)) {
            console.log('Action row builder with that name already exists');
            return;
        }

        createActionRowBuilderClass(filePath, name);

        alert({
            type: 'success',
            msg: `Action row builder ${name} created successfully`,
        });
        alert({
            type: 'info',
            msg: `You can find it in src/modules/${moduleName}/services/actionRows/${name}ActionRowBuilder.ts`,
        });
    }
};

function createActionRowBuilderClass(filePath, name) {
    const project = new Project();
    const sourceFile = project.createSourceFile(filePath, '', { overwrite: true });

    sourceFile.addImportDeclaration({
        namedImports: ['ActionRowBuilder', 'ButtonBuilder', 'ButtonStyle'],
        moduleSpecifier: 'zumito-framework/discord',
    });
    sourceFile.addImportDeclaration({
        namedImports: ['TranslationManager', 'ServiceContainer'],
        moduleSpecifier: 'zumito-framework',
    });

    const className = `${name}ActionRowBuilder`;
    const cls = sourceFile.addClass({
        name: className,
        isExported: true,
    });

    cls.addConstructor({
        parameters: [{
            name: 'translator',
            scope: Scope.Private,
            initializer: 'ServiceContainer.getService(TranslationManager)'
        }],
        statements: '',
    });

    const camelCaseName = name.charAt(0).toUpperCase() + name.slice(1);
    cls.addMethod({
        name: 'getRow',
        parameters: [{ name: 'params', type: '{ locale: string }' }],
        statements: `const { locale } = params;\n\nconst ${camelCaseName}ActionRow = new ActionRowBuilder()\n    .addComponents(\n        new ButtonBuilder()\n            .setCustomId('${camelCaseName}.primary')\n            .setLabel(this.translator.get('actionRows.${camelCaseName}.primary', locale))\n            .setStyle(ButtonStyle.Secondary)\n    )\n    .addComponents(\n        new ButtonBuilder()\n            .setCustomId('${camelCaseName}.secondary')\n            .setLabel(this.translator.get('actionRows.${camelCaseName}.secondary', locale))\n            .setStyle(ButtonStyle.Secondary)\n    );\nreturn ${camelCaseName}ActionRow;`,
    });

    project.saveSync();
}

