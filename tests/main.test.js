import { execSync } from 'child_process';
import fs from 'fs';
import { exec } from 'child_process';

const command = './bin/index.js'
const projectCommand = 'cd test && ../bin/index.js'

test('should create a new project', async () => {
    const params = [
        { name: 'projectName', value: 'test' },
        { name: 'discordToken', value: 'token' },
        { name: 'discordClientId', value: 'client_id' },
        { name: 'discordClientSecret', value: 'client_secret' },
        { name: 'botPrefix', value: 'zt-' },
        { name: 'databaseType', value: 'tingodb' },
    ]
    const commandParams = params.map(param => `--${param.name} "${param.value}"`).join(' ');
    execSync(`${command} create project ${commandParams}`);
    expect(fs.existsSync('test')).toBe(true); 
    expect(fs.existsSync('test/.env')).toBe(true);
    expect(fs.existsSync('test/node_modules')).toBe(true);
    expect(fs.readFileSync('test/.env', 'utf8')).not.toContain('DATABASE_HOST');
    expect(fs.existsSync('test/.git')).toBe(false);
});

test('should create common module', async () => {
    execSync(`${projectCommand} create module testCommon common`);
    expect(fs.existsSync('test/src/modules/testCommon')).toBe(true);
});

test('should create custom module', async () => {
    execSync(`${projectCommand} create module testCustom custom_behavior`);
    expect(fs.existsSync('test/src/modules/testCustom')).toBe(true);
    expect(fs.existsSync('test/src/modules/testCustom/index.ts')).toBe(true);
});

test('should create common command on existent module', async () => {
    const params = [
        { name: 'moduleName', value: 'testCommon' },
        { name: 'name', value: 'test' },
        { name: 'type', value: 'any' },
    ];
    const commandParams = params.map(param => `--${param.name} "${param.value}"`).join(' ');
    execSync(`${projectCommand} create command ${commandParams}`);
    expect(fs.existsSync('test/src/modules/testCommon/commands/test.ts')).toBe(true);
});

test('should create custom command on non-existent module', async () => {
    const params = [
        { name: 'moduleName', value: 'module1' },
        { name: 'name', value: 'test' },
        { name: 'type', value: 'any' },
    ];
    const commandParams = params.map(param => `--${param.name} "${param.value}"`).join(' ');
    execSync(`${projectCommand} create command ${commandParams}`);
    expect(fs.existsSync('test/src/modules/module1/commands/test.ts')).toBe(true);
});

test('should create event on existent module', async () => {
    execSync(`${projectCommand} create event testCommon test`);
    expect(fs.existsSync('test/src/modules/testCommon/events/test.ts')).toBe(true);
});

test('should create event on non-existent module', async () => {
    execSync(`${projectCommand} create event module2 test`);
    expect(fs.existsSync('test/src/modules/module2/events/test.ts')).toBe(true);
});

test('should create model on existent module', async () => {
    execSync(`${projectCommand} create model testCommon test`);
    expect(fs.existsSync('test/src/modules/testCommon/models/test.ts')).toBe(true);
});

test('should create model on non-existent module', async () => {
    execSync(`${projectCommand} create model module3 test`);
    expect(fs.existsSync('test/src/modules/module3/models/test.ts')).toBe(true);
});



afterAll(() => {
    // Remove test project
    if (fs.existsSync('test')) fs.rmdirSync('test', { recursive: true });
});