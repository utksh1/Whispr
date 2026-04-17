const { createServer } = require("./src/create-server");

(async () => {
  try {
    const { server, config } = await createServer();

    server.listen(config.port, () => {
      console.log(`Whispr server running on port ${config.port}`);
    });
  } catch (error) {
    console.error("Failed to start Whispr server:", error);
    process.exit(1);
  }
})();
