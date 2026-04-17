const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

// Swagger Configuration
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
        url: `http://localhost:${process.env.PORT || 4000}`,
        description: "Development server",
      },
    ],
  },
  apis: ["./index.js"], // Path to the API docs
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(helmet());
app.use(cors());
app.use(express.json());

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health Check
 *     description: Returns the status of the Whispr service.
 *     responses:
 *       200:
 *         description: Service is healthy.
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "Whispr Backend" });
});

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register User
 *     description: Create a new user account with a public key.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *                 description: Plaintext password (sent over TLS)
 *               publicKey:
 *                 type: string
 *                 description: Base64 encoded X25519 public key
 *     responses:
 *       201:
 *         description: User created successfully.
 */
app.post("/auth/register", (req, res) => {
  res.status(501).json({ message: "Not implemented yet" });
});

/**
 * @openapi
 * /messages:
 *   post:
 *     summary: Send Message
 *     description: Relay an encrypted message payload to a target user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               conversationId:
 *                 type: string
 *               ciphertext:
 *                 type: string
 *               nonce:
 *                 type: string
 *               receiverId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message accepted for relay.
 */
app.post("/messages", (req, res) => {
  res.status(501).json({ message: "Not implemented yet" });
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Whispr server running on port ${PORT}`);
  console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
});
