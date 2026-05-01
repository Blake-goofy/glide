import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { zodToJsonSchema } from 'zod-to-json-schema';

import { managedPolicySchema } from '../dist/policy.js';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputPath = join(packageRoot, 'dist', 'managed-policy.schema.json');
const generatedSchema = zodToJsonSchema(managedPolicySchema, 'GlideManagedPolicy');
const schema = normalizeManagedPolicySchema(generatedSchema.definitions?.GlideManagedPolicy ?? generatedSchema);

function normalizeManagedPolicySchema(value) {
	if (Array.isArray(value)) {
		return value.map((item) => normalizeManagedPolicySchema(item));
	}

	if (!value || typeof value !== 'object') {
		return value;
	}

	const normalized = Object.fromEntries(
		Object.entries(value)
			.filter(([key, childValue]) => !(key === 'additionalProperties' && typeof childValue === 'boolean'))
			.map(([key, childValue]) => [key, normalizeManagedPolicySchema(childValue)]),
	);

	return normalized;
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(schema, null, 2) + '\n');
