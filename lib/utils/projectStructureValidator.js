import fs from 'fs';

export const verifyPwd = () => {
    if (!fs.existsSync('./src/modules')) {
        alert({
            type: 'error',
            msg: 'src/modules folder does not exist.',
        });
        alert({
            type: 'warning',
            msg: 'Are you running this command in the root folder of your project?',
        });
        process.exit(1);
    }
}

export const validateOrCreateModule = (moduleName) => {

    // check if src/modules exists
    verifyPwd();

    // Check if module exists
    if (!fs.existsSync(`./src/modules/${moduleName}`)) {
        // create module folder
        fs.mkdirSync(`./src/modules/${moduleName}`);
        // create module default folders
        let folders = ['commands', 'events', 'translations', 'routes'];
        folders.forEach((folder) => {
            fs.mkdirSync(`./src/modules/${moduleName}/${folder}`);
        });
    }
}
