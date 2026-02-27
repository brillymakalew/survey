/* eslint-disable @typescript-eslint/no-require-imports */
const bcrypt = require('bcryptjs');
const hash = '$2b$12$gPK0uBGESiVDUiQXILg7T.cDOkicBAyS5EJ5nrLkY3HuvqFLgvRdu';
console.log('password123 matches:', bcrypt.compareSync('password123', hash));
