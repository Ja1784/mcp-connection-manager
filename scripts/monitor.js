#!/usr/bin/env node

const MCPImplementation = require('../src/implementation');

async function monitor() {
  const mcp = new MCPImplementation();
  
  try {
    await mcp.initialize();
    console.log('Starting health monitoring...');
    
    // Print health report every minute
    setInterval(() => {
      const report = mcp.getHealthReport();
      console.clear();
      console.log('Health Report:', new Date().toISOString());
      console.log(JSON.stringify(report, null, 2));
    }, 60000);
    
  } catch (error) {
    console.error('Monitoring failed:', error);
    process.exit(1);
  }
}

monitor();