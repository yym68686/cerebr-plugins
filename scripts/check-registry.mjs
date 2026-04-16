import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const pluginKinds = new Set(['builtin', 'declarative', 'script']);
const pluginScopes = new Set(['page', 'shell', 'prompt', 'background']);
const scriptScopes = new Set(['page', 'shell', 'background']);
const declarativeTypes = new Set(['prompt_fragment', 'request_policy', 'page_extractor']);
const promptPlacements = new Set(['system.prepend', 'system.append']);
const extractorStrategies = new Set(['replace', 'prepend', 'append']);
const availabilityStatuses = new Set(['active', 'disabled']);

function toPosix(value) {
    return value.split(path.sep).join('/');
}

function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assert(condition, message, errors) {
    if (!condition) {
        errors.push(message);
    }
}

function listPluginManifestFiles() {
    const results = [];

    function walk(currentPath) {
        for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
            const fullPath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
                continue;
            }
            if (entry.name === 'plugin.json') {
                results.push(fullPath);
            }
        }
    }

    walk(path.join(projectRoot, 'plugins'));
    return results.sort();
}

function validatePluginManifest(manifest, filePath) {
    const errors = [];
    const relativeFile = toPosix(path.relative(projectRoot, filePath));

    assert(isObject(manifest), `${relativeFile}: manifest must be an object`, errors);
    if (errors.length > 0) {
        return errors;
    }

    const kind = String(manifest.kind ?? '').trim();
    const scope = String(manifest.scope ?? '').trim();

    assert(Number(manifest.schemaVersion) === 1, `${relativeFile}: schemaVersion must be 1`, errors);
    assert(String(manifest.id ?? '').trim().length > 0, `${relativeFile}: id is required`, errors);
    assert(String(manifest.version ?? '').trim().length > 0, `${relativeFile}: version is required`, errors);
    assert(pluginKinds.has(kind), `${relativeFile}: unsupported kind "${kind}"`, errors);
    assert(pluginScopes.has(scope), `${relativeFile}: unsupported scope "${scope}"`, errors);
    assert(String(manifest.displayName ?? '').trim().length > 0, `${relativeFile}: displayName is required`, errors);
    assert(String(manifest.description ?? '').trim().length > 0, `${relativeFile}: description is required`, errors);

    if (scope === 'background') {
        assert(manifest.requiresExtension === true, `${relativeFile}: background plugins must set requiresExtension to true`, errors);
    }

    if (kind === 'script') {
        const script = manifest.script;
        const entry = String(script?.entry ?? '').trim();
        assert(scriptScopes.has(scope), `${relativeFile}: script plugins must target page, shell, or background`, errors);
        assert(isObject(script), `${relativeFile}: script plugins need a script block`, errors);
        assert(entry.length > 0, `${relativeFile}: script.entry is required`, errors);

        if (entry.length > 0 && !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(entry) && !entry.startsWith('/')) {
            const resolved = path.resolve(path.dirname(filePath), entry);
            assert(fs.existsSync(resolved), `${relativeFile}: missing script entry "${entry}"`, errors);
        }
    }

    if (kind === 'declarative') {
        const declarative = manifest.declarative;
        const type = String(declarative?.type ?? '').trim();

        assert(isObject(declarative), `${relativeFile}: declarative plugins need a declarative block`, errors);
        assert(declarativeTypes.has(type), `${relativeFile}: unsupported declarative type "${type}"`, errors);

        if (type === 'prompt_fragment') {
            assert(scope === 'prompt' || scope === 'shell', `${relativeFile}: prompt_fragment must target prompt or shell`, errors);
            assert(promptPlacements.has(String(declarative?.placement ?? '').trim()), `${relativeFile}: invalid prompt placement`, errors);
            assert(String(declarative?.content ?? '').trim().length > 0, `${relativeFile}: prompt_fragment needs content`, errors);
        }

        if (type === 'request_policy') {
            assert(scope === 'shell', `${relativeFile}: request_policy must target shell`, errors);
        }

        if (type === 'page_extractor') {
            assert(scope === 'page', `${relativeFile}: page_extractor must target page`, errors);
            assert(
                extractorStrategies.has(String(declarative?.strategy ?? 'replace').trim()),
                `${relativeFile}: invalid page_extractor strategy`,
                errors
            );
        }
    }

    return errors;
}

function validateRegistry(registryPath) {
    const errors = [];
    const registry = readJson(registryPath);
    const relativeFile = toPosix(path.relative(projectRoot, registryPath));

    assert(isObject(registry), `${relativeFile}: registry must be an object`, errors);
    if (errors.length > 0) {
        return { registry: null, errors };
    }

    assert(Number(registry.schemaVersion) === 1, `${relativeFile}: schemaVersion must be 1`, errors);
    assert(String(registry.registryId ?? '').trim().length > 0, `${relativeFile}: registryId is required`, errors);
    assert(String(registry.displayName ?? '').trim().length > 0, `${relativeFile}: displayName is required`, errors);
    assert(String(registry.generatedAt ?? '').trim().length > 0, `${relativeFile}: generatedAt is required`, errors);
    assert(Array.isArray(registry.plugins), `${relativeFile}: plugins must be an array`, errors);

    for (const [index, entry] of (registry.plugins || []).entries()) {
        const label = `${relativeFile}: plugins[${index}]`;
        const kind = String(entry?.kind ?? '').trim();
        const scope = String(entry?.scope ?? '').trim();
        const installMode = String(entry?.install?.mode ?? '').trim();
        const packageUrl = String(entry?.install?.packageUrl ?? '').trim();
        const availabilityStatus = String(entry?.availability?.status ?? 'active').trim();

        assert(isObject(entry), `${label} must be an object`, errors);
        if (!isObject(entry)) continue;

        assert(String(entry.id ?? '').trim().length > 0, `${label}.id is required`, errors);
        assert(pluginKinds.has(kind), `${label}.kind is invalid`, errors);
        assert(pluginScopes.has(scope), `${label}.scope is invalid`, errors);
        assert(String(entry.displayName ?? '').trim().length > 0, `${label}.displayName is required`, errors);
        assert(String(entry.description ?? '').trim().length > 0, `${label}.description is required`, errors);
        assert(String(entry.latestVersion ?? '').trim().length > 0, `${label}.latestVersion is required`, errors);
        assert(availabilityStatuses.has(availabilityStatus), `${label}.availability.status is invalid`, errors);

        if (scope === 'background') {
            assert(entry.requiresExtension === true, `${label}.requiresExtension must be true`, errors);
        }

        if (kind === 'script' || kind === 'declarative') {
            assert(installMode === 'package', `${label}.install.mode must be "package"`, errors);
            assert(packageUrl.length > 0, `${label}.install.packageUrl is required`, errors);

            if (packageUrl.length > 0) {
                const packagePath = path.resolve(projectRoot, packageUrl);
                assert(fs.existsSync(packagePath), `${label}: missing package "${packageUrl}"`, errors);
                if (fs.existsSync(packagePath)) {
                    const manifest = readJson(packagePath);
                    assert(
                        String(manifest.id ?? '').trim() === String(entry.id ?? '').trim(),
                        `${label}: package id does not match registry id`,
                        errors
                    );
                    assert(
                        String(manifest.version ?? '').trim() === String(entry.latestVersion ?? '').trim(),
                        `${label}: package version does not match latestVersion`,
                        errors
                    );
                }
            }
        }
    }

    return { registry, errors };
}

function main() {
    const registryPath = path.join(projectRoot, 'plugin-registry.json');
    const pluginManifestFiles = listPluginManifestFiles();
    let failureCount = 0;

    const registryValidation = validateRegistry(registryPath);
    if (registryValidation.errors.length > 0) {
        failureCount += registryValidation.errors.length;
        console.error('FAIL plugin-registry.json');
        for (const error of registryValidation.errors) {
            console.error(`  - ${error}`);
        }
    } else {
        console.log('OK  plugin-registry.json');
    }

    for (const filePath of pluginManifestFiles) {
        const errors = validatePluginManifest(readJson(filePath), filePath);
        const relativeFile = toPosix(path.relative(projectRoot, filePath));

        if (errors.length > 0) {
            failureCount += errors.length;
            console.error(`FAIL ${relativeFile}`);
            for (const error of errors) {
                console.error(`  - ${error}`);
            }
            continue;
        }

        console.log(`OK  ${relativeFile}`);
    }

    if (failureCount > 0) {
        process.exitCode = 1;
        return;
    }

    console.log(`Validated ${pluginManifestFiles.length + 1} file(s).`);
}

main();
