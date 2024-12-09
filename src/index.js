const MCPImplementation = require('./implementation');

async function start() {
  const mcp = new MCPImplementation();
  
  try {
    await mcp.initialize();
    console.log('MCP implementation initialized');
    
    const healthReport = mcp.getHealthReport();
    console.log('Initial health report:', healthReport);

    // Handle process termination
    process.on('SIGINT', async () => {
      console.log('Shutting down...');
      mcp.disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start MCP implementation:', error);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  start().catch(console.error);
}

module.exports = { start };