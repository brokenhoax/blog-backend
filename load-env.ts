import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production.local"
    : ".env.production";

dotenv.config({ path: path.join(rootDir, envFile) });
