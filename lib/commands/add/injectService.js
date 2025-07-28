import { Project, Scope } from 'ts-morph';
import alert from 'cli-alerts';

export const injectService = {
    command: 'injectService',
    description: 'Inject a service into a class',
    options: [
        { label: 'File path', type: 'string', key: 'file' },
        { label: 'Service import path', type: 'string', key: 'servicePath' },
        { label: 'Service class name', type: 'string', key: 'serviceClass' },
        { label: 'Property name', type: 'string', key: 'propertyName' }
    ],
    action: async ({ file, servicePath, serviceClass, propertyName }) => {
        const project = new Project();
        const sourceFile = project.addSourceFileAtPath(file);

        // Add service import
        let importDecl = sourceFile.getImportDeclaration(d => d.getModuleSpecifierValue() === servicePath);
        if (importDecl) {
            if (!importDecl.getNamedImports().some(n => n.getName() === serviceClass)) {
                importDecl.addNamedImport(serviceClass);
            }
        } else {
            sourceFile.addImportDeclaration({ namedImports: [serviceClass], moduleSpecifier: servicePath });
        }

        // Ensure ServiceContainer import
        let scImport = sourceFile.getImportDeclaration(d => d.getModuleSpecifierValue() === 'zumito-framework');
        if (scImport) {
            if (!scImport.getNamedImports().some(n => n.getName() === 'ServiceContainer')) {
                scImport.addNamedImport('ServiceContainer');
            }
        } else {
            sourceFile.addImportDeclaration({ namedImports: ['ServiceContainer'], moduleSpecifier: 'zumito-framework' });
        }

        const clazz = sourceFile.getClasses()[0];
        if (!clazz) {
            console.error('No class found in file');
            return;
        }

        let ctor = clazz.getConstructors()[0];
        if (!ctor) {
            ctor = clazz.addConstructor({});
        }

        const paramName = propertyName || serviceClass.charAt(0).toLowerCase() + serviceClass.slice(1);
        if (!ctor.getParameters().some(p => p.getName() === paramName)) {
            ctor.addParameter({
                name: paramName,
                scope: Scope.Private,
                initializer: `ServiceContainer.getService(${serviceClass})`
            });
        }

        sourceFile.saveSync();
        alert({ type: 'success', msg: `Service injected successfully` });
    }
};
