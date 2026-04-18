const { z: zod } = require("zod");
const { HttpError } = require("./errors");

const usernameSchema = zod
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-zA-Z0-9-]+$/);

const passwordSchema = zod.string().min(8).max(128);
const publicKeySchema = zod.string().min(1);
const ciphertextSchema = zod.string().min(1);
const nonceSchema = zod.string().min(1);
const saltSchema = zod.string().min(1);
const versionSchema = zod.string().trim().min(1);
const backupCiphertextSchema = zod.string().min(1);
const backupIvSchema = zod.string().min(1);

const registerSchema = zod.object({
  username: usernameSchema,
  password: passwordSchema,
});

const loginSchema = zod.object({
  username: usernameSchema,
  password: passwordSchema,
});

const publicKeyUpdateSchema = zod.object({
  publicKey: publicKeySchema,
});

const privateKeyBackupSchema = zod.object({
  ciphertext: backupCiphertextSchema,
  salt: saltSchema,
  iv: backupIvSchema,
  version: versionSchema,
});

const createMessageSchema = zod.object({
  ciphertext: ciphertextSchema,
  nonce: nonceSchema,
  salt: saltSchema,
  version: versionSchema,
});

function validate(schema, input) {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    throw new HttpError(400, "invalid_request", JSON.stringify(parsed.error.issues));
  }

  return parsed.data;
}

module.exports = {
  validate,
  usernameSchema,
  registerSchema,
  loginSchema,
  publicKeyUpdateSchema,
  privateKeyBackupSchema,
  createMessageSchema,
};
