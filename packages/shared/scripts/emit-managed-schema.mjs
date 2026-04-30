import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { zodToJsonSchema } from 'zod-to-json-schema';

import { managedPolicySchema } from '../dist/policy.js';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(packageRoot, 'dist', 'managed-policy.schema.json');
const schema = zodToJsonSchema(managedPolicySchema, 'GlideManagedPolicy');

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(schema, null, 2) + '\n');
