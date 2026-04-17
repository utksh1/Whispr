const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

function setupSwagger(app, config) {
  const swaggerOptions = {
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Whispr API Documentation",
        version: "1.0.0",
        description: "Secure E2EE Messaging Backend API",
      },
      servers: [
        {
          url: `http://localhost:${config.port}`,
          description: "Development server",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
    // Search for annotations in the routes directory
    apis: ["./src/routes/*.js", "./src/register-routes.js"],
  };

  const swaggerDocs = swaggerJsdoc(swaggerOptions);
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));
  
  console.log(`Swagger UI available at http://localhost:${config.port}/api-docs`);
}

module.exports = {
  setupSwagger,
};
