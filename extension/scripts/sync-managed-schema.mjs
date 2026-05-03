import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(extensionRoot, '..', 'packages', 'shared', 'dist', 'managed-policy.schema.json');
const targetPath = join(extensionRoot, 'public', 'managed-policy.schema.json');

await mkdir(dirname(targetPath), { recursive: true });
await cp(sourcePath, targetPath);