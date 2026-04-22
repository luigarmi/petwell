import { commonEnvSchema, databaseEnvSchema, loadEnv, mergeSchemas, telemedEnvSchema } from '@petwell/shared-config';

export const env = loadEnv(mergeSchemas(commonEnvSchema, databaseEnvSchema, telemedEnvSchema), process.env);
