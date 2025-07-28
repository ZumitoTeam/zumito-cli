import fs from 'fs';
import path from 'path';
import { Project, Scope } from 'ts-morph';
import { validateOrCreateModule } from '../../utils/projectStructureValidator.js';
import alert from 'cli-alerts';
import inquirer from 'inquirer';

export const embedBuilder = {
    command: 'embedBuilder',
    description: 'Generate an embed builder service',
    options: [{
        label: 'Module name',
        type: 'string',
        key: 'moduleName'
    }, {
        label: 'Service name',
        type: 'string',
        key: 'name'
    }, {
        label: 'Method name',
        type: 'string',
        key: 'methodName',
        manualParse: true
    }],
    action: async ({ moduleName, name, methodName }) => {
        validateOrCreateModule(moduleName);

        const embedsFolder = path.join('./', 'src', 'modules', moduleName, 'services', 'embeds');

        if (!fs.existsSync(embedsFolder)) {
            fs.mkdirSync(embedsFolder, { recursive: true });
        }

        const filePath = path.join(embedsFolder, `${name}EmbedBuilder.ts`);
        const fileExists = fs.existsSync(filePath);

        if (fileExists && !methodName) {
            methodName = await inquirer.prompt({
                type: 'input',
                name: 'methodName',
                message: 'Method name:',
            }).then(a => a.methodName);
        }

        if (fileExists) {
            addMethodToEmbedBuilder(filePath, methodName);
            alert({
                type: 'success',
                msg: `Method ${methodName} added to ${name}EmbedBuilder`,
            });
        } else {
            createEmbedBuilderClass(filePath, name, methodName || 'getEmbed');
            alert({
                type: 'success',
                msg: `Embed builder ${name} created successfully`,
            });
            alert({
                type: 'info',
                msg: `You can find it in src/modules/${moduleName}/services/embeds/${name}EmbedBuilder.ts`,
            });
        }
    }
};

function createEmbedBuilderClass(filePath, name, methodName = 'getEmbed') {
    const project = new Project();
    const sourceFile = project.createSourceFile(filePath, '', { overwrite: true });

    sourceFile.addImportDeclaration({
        namedImports: ['EmbedBuilder'],
        moduleSpecifier: 'zumito-framework/discord',
    });
    sourceFile.addImportDeclaration({
        namedImports: ['TranslationManager', 'ServiceContainer'],
        moduleSpecifier: 'zumito-framework',
    });

    const className = `${name}EmbedBuilder`;
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

    const camelCaseName = methodName.charAt(0).toUpperCase() + methodName.slice(1);
    cls.addMethod({
        name: methodName,
        parameters: [{ name: 'params', type: '{ locale: string }' }],
        statements: `const { locale } = params;\n\nconst ${camelCaseName}Embed = new EmbedBuilder()\n    .setTitle(this.translator.get('embeds.${camelCaseName}.title', locale))\n    .setDescription(this.translator.get('embeds.${camelCaseName}.description', locale))\n    .setColor(config.colors.primary)\n    .setThumbnail(config.client.user.avatarURL())\n    .setFooter({ text: config.client.user.tag, iconURL: config.client.user.avatarURL() })\n    .setTimestamp();\n\nreturn ${camelCaseName}Embed;`,
    });

    project.saveSync();
}

function addMethodToEmbedBuilder(filePath, methodName) {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);
    const cls = sourceFile.getClasses()[0];
    if (!cls) return;
    if (cls.getMethod(methodName)) return;
    const camelCaseName = methodName.charAt(0).toUpperCase() + methodName.slice(1);
    cls.addMethod({
        name: methodName,
        parameters: [{ name: 'params', type: '{ locale: string }' }],
        statements: `const { locale } = params;\n\nconst ${camelCaseName}Embed = new EmbedBuilder()\n    .setTitle(this.translator.get('embeds.${camelCaseName}.title', locale))\n    .setDescription(this.translator.get('embeds.${camelCaseName}.description', locale))\n    .setColor(config.colors.primary)\n    .setThumbnail(config.client.user.avatarURL())\n    .setFooter({ text: config.client.user.tag, iconURL: config.client.user.avatarURL() })\n    .setTimestamp();\n\nreturn ${camelCaseName}Embed;`,
    });
    sourceFile.saveSync();
}

