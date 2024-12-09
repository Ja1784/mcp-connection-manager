#!/usr/bin/env node

const { start } = require('../src/index');

start().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});