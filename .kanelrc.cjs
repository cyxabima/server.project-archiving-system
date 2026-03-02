const { generateZodSchemas } = require('kanel-zod');
require('dotenv').config();
/** @type {import('kanel').Config} */
module.exports = {
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DATABASE,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
  },
  outputPath: './src/db/types',
  preDeleteOutputFolder: true,

  // For NodeNext, 'esm' is correct for the output files
  tsModuleFormat: 'esm',

  schemas: ['public'],
  camelCase: true,

  customTypeMap: {
    'pg_catalog.int8': 'number',
    'pg_catalog.numeric': 'number',
    'pg_catalog.timestamptz': 'Date',
  },
  preRenderHooks: [generateZodSchemas],
};
