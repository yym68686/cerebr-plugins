import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const pluginsRoot = path.join(projectRoot, 'plugins');
const strictMode = process.argv.includes('--strict');

function normalizeString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseSemver(version) {
    const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(normalizeString(version));
    if (!match) {
        return null;
    }

    return {
        raw: normalizeString(version),
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
    };
}

function compareSemver(left, right) {
    if (left.major !== right.major) return left.major - right.major;
    if (left.minor !== right.minor) return left.minor - right.minor;
    return left.patch - right.patch;
}

function listTrackingFiles(rootPath) {
    if (!fs.existsSync(rootPath)) {
        return [];
    }

    return fs.readdirSync(rootPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(rootPath, entry.name, 'UPSTREAM.json'))
        .filter((filePath) => fs.existsSync(filePath));
}

function listUpstreamTags(repository, tagPrefix) {
    const remoteUrl = `https://github.com/${repository}.git`;
    const output = execFileSync('git', ['ls-remote', '--tags', remoteUrl], {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    const tagsByVersion = new Map();
    output.split('\n').forEach((line) => {
        const [commit, ref] = line.trim().split(/\s+/);
        if (!commit || !ref || !ref.startsWith('refs/tags/')) {
            return;
        }

        const fullTag = ref.slice('refs/tags/'.length).replace(/\^\{\}$/, '');
        if (!fullTag.startsWith(tagPrefix)) {
            return;
        }

        const version = fullTag.slice(tagPrefix.length);
        const parsed = parseSemver(version);
        if (!parsed) {
            return;
        }

        const current = tagsByVersion.get(parsed.raw);
        if (!current || ref.endsWith('^{}')) {
            tagsByVersion.set(parsed.raw, {
                version: parsed,
                tag: fullTag,
                commit,
            });
        }
    });

    return [...tagsByVersion.values()].sort((left, right) => {
        return compareSemver(right.version, left.version);
    });
}

function loadTrackedPlugins() {
    return listTrackingFiles(pluginsRoot).map((filePath) => {
        const payload = readJson(filePath);
        return {
            filePath,
            pluginId: normalizeString(payload.pluginId),
            displayName: normalizeString(payload.displayName, normalizeString(payload.pluginId)),
            latestVersion: normalizeString(payload.reviewedPackage?.latestVersion),
            packagePath: normalizeString(payload.reviewedPackage?.packagePath),
            repository: normalizeString(payload.upstream?.repository),
            tagPrefix: normalizeString(payload.upstream?.tagPrefix, 'v'),
            trackedTag: normalizeString(payload.upstream?.trackedTag),
        };
    }).filter((entry) => entry.pluginId && entry.latestVersion && entry.repository);
}

function formatStatusLine(status, entry, detail) {
    return `[${status}] ${entry.pluginId} (${entry.displayName}) ${detail}`;
}

function main() {
    const trackedPlugins = loadTrackedPlugins();
    if (trackedPlugins.length === 0) {
        console.log('No tracked upstream plugins found.');
        return;
    }

    const staleEntries = [];

    trackedPlugins.forEach((entry) => {
        const trackedVersion = parseSemver(entry.latestVersion);
        if (!trackedVersion) {
            throw new Error(`Tracked version is not semver: ${entry.latestVersion} (${entry.filePath})`);
        }

        const upstreamTags = listUpstreamTags(entry.repository, entry.tagPrefix);
        if (upstreamTags.length === 0) {
            throw new Error(`No matching upstream tags found for ${entry.pluginId} from ${entry.repository}`);
        }

        const latestUpstream = upstreamTags[0];
        const delta = compareSemver(latestUpstream.version, trackedVersion);

        if (delta > 0) {
            staleEntries.push({
                ...entry,
                latestUpstream,
            });
            console.log(
                formatStatusLine(
                    'update',
                    entry,
                    `reviewed=${entry.latestVersion}, upstream=${latestUpstream.version.raw} (${latestUpstream.tag})`
                )
            );
            return;
        }

        console.log(
            formatStatusLine(
                'ok',
                entry,
                `reviewed=${entry.latestVersion}, upstream=${latestUpstream.version.raw} (${latestUpstream.tag})`
            )
        );
    });

    if (staleEntries.length === 0) {
        console.log(`All tracked upstream plugins are up to date (${trackedPlugins.length}).`);
        return;
    }

    console.log(
        `Detected ${staleEntries.length} tracked upstream plugin update(s). Review and vendor them manually before publishing.`
    );

    if (strictMode) {
        process.exitCode = 1;
    }
}

main();
