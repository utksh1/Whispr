const path = require("node:path");
const swaggerJsdoc = require("swagger-jsdoc");

function createSwaggerSpec(config) {
  return swaggerJsdoc({
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Whispr API",
        version: "1.0.0",
        description:
          "Authenticated blind-relay backend for Whispr secure messaging. The server stores ciphertext and metadata, but never plaintext.",
      },
      tags: [
        { name: "Meta", description: "Public service metadata and health checks" },
        { name: "Auth", description: "Registration, login, and authenticated user info" },
        { name: "Users", description: "Public key upload and user discovery" },
        { name: "Messages", description: "Encrypted conversation history and send flow" },
        { name: "Demo", description: "Demo-only tamper controls" },
      ],
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
        schemas: {
          ErrorResponse: {
            type: "object",
            required: ["error"],
            properties: {
              error: {
                type: "string",
                example: "missing_token",
              },
              details: {
                type: "object",
                additionalProperties: true,
              },
            },
          },
          AuthUser: {
            type: "object",
            required: ["id", "username", "hasPublicKey", "hasPrivateKeyBackup"],
            properties: {
              id: {
                type: "string",
                format: "uuid",
              },
              username: {
                type: "string",
                example: "alice",
              },
              hasPublicKey: {
                type: "boolean",
              },
              activePublicKeyId: {
                type: "string",
                nullable: true,
              },
              hasPrivateKeyBackup: {
                type: "boolean",
              },
            },
          },
          DirectoryUser: {
            type: "object",
            required: ["id", "username", "hasPublicKey"],
            properties: {
              id: {
                type: "string",
                format: "uuid",
              },
              username: {
                type: "string",
              },
              hasPublicKey: {
                type: "boolean",
              },
              activePublicKeyId: {
                type: "string",
                nullable: true,
              },
              hasPrivateKeyBackup: {
                type: "boolean",
              },
            },
          },
          PublicKeyRecord: {
            type: "object",
            required: ["id", "username", "publicKey", "isActive"],
            properties: {
              id: {
                type: "string",
              },
              username: {
                type: "string",
              },
              publicKey: {
                type: "string",
              },
              isActive: {
                type: "boolean",
              },
              revokedAt: {
                type: "string",
                format: "date-time",
                nullable: true,
              },
            },
          },
          PrivateKeyBackup: {
            type: "object",
            required: ["ciphertext", "salt", "iv", "version"],
            properties: {
              userId: {
                type: "string",
                format: "uuid",
              },
              ciphertext: {
                type: "string",
              },
              salt: {
                type: "string",
              },
              iv: {
                type: "string",
              },
              version: {
                type: "string",
                example: "backup-pbkdf2-aes-gcm-v1",
              },
              updatedAt: {
                type: "string",
                format: "date-time",
              },
            },
          },
          Message: {
            type: "object",
            required: [
              "id",
              "conversationId",
              "senderUsername",
              "receiverUsername",
              "ciphertext",
              "nonce",
              "salt",
              "version",
              "createdAt",
              "tampered",
            ],
            properties: {
              id: {
                type: "string",
                format: "uuid",
              },
              conversationId: {
                type: "string",
                format: "uuid",
              },
              senderKeyId: {
                type: "string",
                nullable: true,
              },
              receiverKeyId: {
                type: "string",
                nullable: true,
              },
              senderUsername: {
                type: "string",
              },
              receiverUsername: {
                type: "string",
              },
              ciphertext: {
                type: "string",
              },
              nonce: {
                type: "string",
              },
              salt: {
                type: "string",
              },
              version: {
                type: "string",
                example: "p256-hkdf-aes-gcm-v2",
              },
              createdAt: {
                type: "string",
                format: "date-time",
              },
              tampered: {
                type: "boolean",
              },
            },
          },
        },
      },
    },
    apis: [
      path.join(__dirname, "routes/*.js"),
      path.join(__dirname, "register-routes.js"),
    ],
  });
}

function setupSwagger(app, config) {
  const swaggerSpec = createSwaggerSpec(config);

  app.get("/openapi.json", (req, res) => {
    res.json(swaggerSpec);
  });

  app.get(["/api-docs", "/api-docs/"], (req, res) => {
    res.redirect(301, "/docs/");
  });

  app.get(["/docs", "/docs/"], (req, res) => {
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "base-uri 'self'",
        "font-src 'self' https://unpkg.com data:",
        "form-action 'self'",
        "frame-ancestors 'self'",
        "img-src 'self' data: https://validator.swagger.io",
        "object-src 'none'",
        "script-src 'self' 'unsafe-inline' https://unpkg.com",
        "style-src 'self' 'unsafe-inline' https://unpkg.com",
        "upgrade-insecure-requests",
      ].join(";")
    );
    res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Whispr API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
    <style>
      body { margin: 0; background: #fafafa; }
      .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
      window.onload = function () {
        window.ui = SwaggerUIBundle({
          url: "/openapi.json",
          dom_id: "#swagger-ui",
          deepLinking: true,
          persistAuthorization: true,
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
          ],
          layout: "StandaloneLayout"
        });
      };
    </script>
  </body>
</html>`);
  });
}

module.exports = {
  createSwaggerSpec,
  setupSwagger,
};
