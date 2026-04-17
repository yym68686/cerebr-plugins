import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const defaultTargetRoot = path.resolve(projectRoot, '..', 'cerebr');

function toPosix(value) {
    return value.split(path.sep).join('/');
}

function parseArgs(argv) {
    const args = { check: false, target: defaultTargetRoot };
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--check') {
            args.check = true;
            continue;
        }
        if (token === '--target') {
            const next = argv[index + 1];
            if (!next) {
                throw new Error('--target requires a path');
            }
            args.target = path.resolve(next);
            index += 1;
            continue;
        }
        throw new Error(`Unknown argument: ${token}`);
    }
    return args;
}

async function ensurePathExists(targetPath, label) {
    try {
        await fs.access(targetPath);
    } catch {
        throw new Error(`${label} not found: ${targetPath}`);
    }
}

async function listRelativeFiles(rootPath) {
    const files = [];

    async function walk(currentPath, relativeBase = '') {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        entries.sort((left, right) => left.name.localeCompare(right.name));

        for (const entry of entries) {
            const absolutePath = path.join(currentPath, entry.name);
            const relativePath = relativeBase ? path.join(relativeBase, entry.name) : entry.name;
            if (entry.isDirectory()) {
                await walk(absolutePath, relativePath);
                continue;
            }
            files.push(relativePath);
        }
    }

    await walk(rootPath);
    return files;
}

async function compareDirectoryTrees(sourceRoot, targetRoot, label) {
    const [sourceFiles, targetFiles] = await Promise.all([
        listRelativeFiles(sourceRoot),
        listRelativeFiles(targetRoot),
    ]);

    const sourceSet = new Set(sourceFiles);
    const targetSet = new Set(targetFiles);
    const mismatches = [];

    sourceFiles.forEach((relativePath) => {
        if (!targetSet.has(relativePath)) {
            mismatches.push(`${label}: missing ${toPosix(relativePath)} in target`);
        }
    });

    targetFiles.forEach((relativePath) => {
        if (!sourceSet.has(relativePath)) {
            mismatches.push(`${label}: unexpected ${toPosix(relativePath)} in target`);
        }
    });

    const commonFiles = sourceFiles.filter((relativePath) => targetSet.has(relativePath));
    for (const relativePath of commonFiles) {
        const [sourceContent, targetContent] = await Promise.all([
            fs.readFile(path.join(sourceRoot, relativePath)),
            fs.readFile(path.join(targetRoot, relativePath)),
        ]);
        if (!sourceContent.equals(targetContent)) {
            mismatches.push(`${label}: content mismatch for ${toPosix(relativePath)}`);
        }
    }

    return mismatches;
}

async function syncFile(sourcePath, targetPath) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
}

async function syncDirectory(sourcePath, targetPath) {
    await fs.rm(targetPath, { recursive: true, force: true });
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.cp(sourcePath, targetPath, { recursive: true });
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const targetRoot = args.target;
    const targetStaticsRoot = path.join(targetRoot, 'statics');

    await ensurePathExists(path.join(projectRoot, 'plugin-registry.json'), 'Source registry');
    await ensurePathExists(path.join(projectRoot, 'plugins'), 'Source plugins directory');
    await ensurePathExists(path.join(projectRoot, 'runtime'), 'Source runtime directory');
    await ensurePathExists(targetStaticsRoot, 'Target statics directory');

    const pairs = [
        {
            label: 'plugin-registry.json',
            source: path.join(projectRoot, 'plugin-registry.json'),
            target: path.join(targetStaticsRoot, 'plugin-registry.json'),
            type: 'file',
        },
        {
            label: 'plugins',
            source: path.join(projectRoot, 'plugins'),
            target: path.join(targetStaticsRoot, 'plugins'),
            type: 'directory',
        },
        {
            label: 'runtime',
            source: path.join(projectRoot, 'runtime'),
            target: path.join(targetStaticsRoot, 'runtime'),
            type: 'directory',
        },
    ];

    if (args.check) {
        const mismatches = [];

        for (const pair of pairs) {
            if (pair.type === 'file') {
                try {
                    const [sourceContent, targetContent] = await Promise.all([
                        fs.readFile(pair.source),
                        fs.readFile(pair.target),
                    ]);
                    if (!sourceContent.equals(targetContent)) {
                        mismatches.push(`${pair.label}: file content mismatch`);
                    }
                } catch (error) {
                    mismatches.push(`${pair.label}: ${error?.message || String(error)}`);
                }
                continue;
            }

            try {
                mismatches.push(...await compareDirectoryTrees(pair.source, pair.target, pair.label));
            } catch (error) {
                mismatches.push(`${pair.label}: ${error?.message || String(error)}`);
            }
        }

        if (mismatches.length > 0) {
            console.error('Cerebr bundled fallback is out of sync with cerebr-plugins:');
            mismatches.forEach((message) => console.error(`  - ${message}`));
            process.exitCode = 1;
            return;
        }

        console.log(`Bundled fallback is in sync: ${targetStaticsRoot}`);
        return;
    }

    await syncFile(
        path.join(projectRoot, 'plugin-registry.json'),
        path.join(targetStaticsRoot, 'plugin-registry.json'),
    );
    await syncDirectory(
        path.join(projectRoot, 'plugins'),
        path.join(targetStaticsRoot, 'plugins'),
    );
    await syncDirectory(
        path.join(projectRoot, 'runtime'),
        path.join(targetStaticsRoot, 'runtime'),
    );

    console.log(`Synced Cerebr bundled fallback to ${targetStaticsRoot}`);
}

main().catch((error) => {
    console.error(error?.message || String(error));
    process.exitCode = 1;
});
