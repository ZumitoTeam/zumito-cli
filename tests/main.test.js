import { execSync } from 'child_process';
import fs from 'fs';
import { exec } from 'child_process';

const projectCommand = 'cd test && ../bin/index.js'
const runCommand = (command, args, options) => {
    let executablePath = command == 'create project' ? './bin/index.js' : projectCommand;
    const commandParams = args.map(param => `--${param.name} "${param.value}"`).join(' ');
    execSync(`${executablePath} ${command} ${commandParams}`);
}

test('should create a new project', async () => {
    runCommand('create project', [
        { name: 'projectName', value: 'test' },
        { name: 'discordToken', value: 'token' },
        { name: 'discordClientId', value: 'client_id' },
        { name: 'discordClientSecret', value: 'client_secret' },
        { name: 'botPrefix', value: 'zt-' },
        { name: 'databaseType', value: 'tingodb' }
    ]);
    expect(fs.existsSync('test')).toBe(true); 
    expect(fs.existsSync('test/.env')).toBe(true);
    expect(fs.existsSync('test/node_modules')).toBe(true);
    expect(fs.readFileSync('test/.env', 'utf8')).not.toContain('DATABASE_HOST');
    expect(fs.existsSync('test/.git')).toBe(false);
});

test('should create common module', async () => {
    runCommand('create module', [
        { name: 'name', value: 'testCommon' },
        { name: 'type', value: 'common' },
    ]);
    expect(fs.existsSync('test/src/modules/testCommon')).toBe(true);
});

test('should create custom module', async () => {
    runCommand('create module', [
        { name: 'name', value: 'testCustom' },
        { name: 'type', value: 'custom_behavior' },
    ]);
    expect(fs.existsSync('test/src/modules/testCustom')).toBe(true);
    expect(fs.existsSync('test/src/modules/testCustom/index.ts')).toBe(true);
});

test('should create common command on existent module', async () => {
    runCommand('create command', [
        { name: 'moduleName', value: 'testCommon' },
        { name: 'name', value: 'test' },
        { name: 'type', value: 'any' },
    ]);
    expect(fs.existsSync('test/src/modules/testCommon/commands/test.ts')).toBe(true);
});

test('should create custom command on non-existent module', async () => {
    runCommand('create command', [
        { name: 'moduleName', value: 'module1' },
        { name: 'name', value: 'test' },
        { name: 'type', value: 'any' },
    ]);
    expect(fs.existsSync('test/src/modules/module1/commands/test.ts')).toBe(true);
});

test('should create event on existent module', async () => {
    runCommand('create event', [
        { name: 'moduleName', value: 'testCommon' },
        { name: 'name', value: 'test' }
    ]);
    expect(fs.existsSync('test/src/modules/testCommon/events/test.ts')).toBe(true);
});

test('should create event on non-existent module', async () => {
    runCommand('create event', [
        { name: 'moduleName', value: 'module2' },
        { name: 'name', value: 'test' }
    ]);
    expect(fs.existsSync('test/src/modules/module2/events/test.ts')).toBe(true);
});

test('should create model on existent module', async () => {
    runCommand('create model', [
        { name: 'moduleName', value: 'testCommon' },
        { name: 'name', value: 'test' }
    ]);
    expect(fs.existsSync('test/src/modules/testCommon/models/test.ts')).toBe(true);
});

test('should create model on non-existent module', async () => {
    runCommand('create model', [
        { name: 'moduleName', value: 'module3' },
        { name: 'name', value: 'test' }
    ]);
    expect(fs.existsSync('test/src/modules/module3/models/test.ts')).toBe(true);
});

test('should create route on existent module', async () => {
    runCommand('create route', [
        { name: 'moduleName', value: 'testCommon' },
        { name: 'name', value: 'test' }
    ]);
    expect(fs.existsSync('test/src/modules/testCommon/routes/Test.ts')).toBe(true);
});

test('should create route on non-existent module', async () => {
    runCommand('create route', [
        { name: 'moduleName', value: 'module4' },
        { name: 'name', value: 'test' }
    ]);
    expect(fs.existsSync('test/src/modules/module4/routes/Test.ts')).toBe(true);
});

test('should create embed builder on existent module', async () => {
    runCommand('create embedBuilder', [
        { name: 'moduleName', value: 'testCommon' },
        { name: 'name', value: 'Help' }
    ]);
    expect(fs.existsSync('test/src/modules/testCommon/services/embeds/HelpEmbedBuilder.ts')).toBe(true);
});

test('should create embed builder on non-existent module', async () => {
    runCommand('create embedBuilder', [
        { name: 'moduleName', value: 'module5' },
        { name: 'name', value: 'Help' }
    ]);
    expect(fs.existsSync('test/src/modules/module5/services/embeds/HelpEmbedBuilder.ts')).toBe(true);
});

test('should inject service into command', async () => {
    const file = 'src/modules/testCommon/commands/test.ts';
    runCommand('add injectService', [
        { name: 'file', value: file },
        { name: 'servicePath', value: '../services/embeds/HelpEmbedBuilder' },
        { name: 'serviceClass', value: 'HelpEmbedBuilder' },
        { name: 'propertyName', value: 'helpEmbedBuilder' }
    ]);
    const content = fs.readFileSync(`test/${file}`, 'utf8');
    expect(content).toContain('HelpEmbedBuilder');
    expect(content).toContain('ServiceContainer.getService(HelpEmbedBuilder)');
});



afterAll(() => {
    // Remove test project
    if (fs.existsSync('test')) fs.rmdirSync('test', { recursive: true });
});