/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const moveDir = (src, dest) => {
    if (fs.existsSync(src)) {
        fs.renameSync(src, dest);
        console.log(`Moved ${src} to ${dest}`);
    } else {
        console.log(`Not found: ${src}`);
    }
};

const appDir = path.join(__dirname, '..', 'app');
moveDir(path.join(appDir, 'survey', 'panel', '[panelCode]'), path.join(appDir, '[panelCode]'));
moveDir(path.join(appDir, 'survey', 'done'), path.join(appDir, 'done'));
moveDir(path.join(appDir, 'survey', 'between'), path.join(appDir, 'between'));

const surveyDir = path.join(appDir, 'survey');
if (fs.existsSync(surveyDir)) {
    fs.rmSync(surveyDir, { recursive: true, force: true });
    console.log(`Deleted ${surveyDir}`);
}
