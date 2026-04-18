import { Account, Client, Databases } from "appwrite";

export const APPWRITE_CONFIG = {
  endpoint:
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT?.trim() ||
    "https://nyc.cloud.appwrite.io/v1",
  projectId:
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim() ||
    "69e2ba2700132ed5d552",
  projectName:
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_NAME?.trim() ||
    "Whispr",
  databaseId:
    process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID?.trim() ||
    "whispr",
  collections: {
    users:
      process.env.NEXT_PUBLIC_APPWRITE_USERS_COLLECTION_ID?.trim() ||
      "users",
    userKeys:
      process.env.NEXT_PUBLIC_APPWRITE_USER_KEYS_COLLECTION_ID?.trim() ||
      "user_keys",
    privateKeyBackups:
      process.env.NEXT_PUBLIC_APPWRITE_PRIVATE_KEY_BACKUPS_COLLECTION_ID?.trim() ||
      "private_key_backups",
    messages:
      process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID?.trim() ||
      "messages",
  },
};

export const appwriteClient = new Client()
  .setEndpoint(APPWRITE_CONFIG.endpoint)
  .setProject(APPWRITE_CONFIG.projectId);

export const appwriteAccount = new Account(appwriteClient);
export const appwriteDatabases = new Databases(appwriteClient);

