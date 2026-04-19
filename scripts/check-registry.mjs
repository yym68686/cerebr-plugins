import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const pluginKinds = new Set(['builtin', 'declarative', 'script']);
const pluginScopes = new Set(['page', 'shell', 'prompt', 'background']);
const scriptScopes = new Set(['page', 'shell', 'background']);
const legacyDeclarativeTypes = new Set(['prompt_fragment', 'request_policy', 'page_extractor']);
const promptPlacements = new Set(['system.prepend', 'system.append']);
const extractorStrategies = new Set(['replace', 'prepend', 'append']);
const availabilityStatuses = new Set(['active', 'disabled']);
const shellExecuteTypes = new Set(['import_text', 'insert_text', 'set_draft', 'show_toast', 'open_page']);
const contributionTypes = new Set([
    'promptFragments',
    'requestPolicies',
    'pageExtractors',
    'selectionActions',
    'inputActions',
    'menuItems',
    'slashCommands',
]);

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

function validateStringArray(value, label, errors) {
    assert(Array.isArray(value), `${label} must be an array`, errors);
    if (!Array.isArray(value)) {
        return;
    }

    value.forEach((item, index) => {
        assert(
            typeof item === 'string' && item.trim().length > 0,
            `${label}[${index}] must be a non-empty string`,
            errors
        );
    });
}

function validatePromptFragments(value, label, errors) {
    const values = Array.isArray(value) ? value : [value];
    values.forEach((fragment, index) => {
        const fragmentLabel = `${label}[${index}]`;
        if (typeof fragment === 'string') {
            assert(fragment.trim().length > 0, `${fragmentLabel} must be a non-empty string`, errors);
            return;
        }

        assert(isObject(fragment), `${fragmentLabel} must be a string or object`, errors);
        if (!isObject(fragment)) {
            return;
        }

        const hasContent = typeof fragment.content === 'string' && fragment.content.trim().length > 0;
        const hasContentKey = typeof fragment.contentKey === 'string' && fragment.contentKey.trim().length > 0;
        assert(hasContent || hasContentKey, `${fragmentLabel} needs content or contentKey`, errors);

        if (fragment.placement !== undefined) {
            assert(
                promptPlacements.has(String(fragment.placement).trim()),
                `${fragmentLabel}.placement must be system.prepend or system.append`,
                errors
            );
        }
    });
}

function validateRequestPolicy(policy, label, errors) {
    assert(isObject(policy), `${label} must be an object`, errors);
    if (!isObject(policy)) {
        return;
    }

    if (policy.applyTo !== undefined) {
        assert(isObject(policy.applyTo), `${label}.applyTo must be an object`, errors);
        if (isObject(policy.applyTo)) {
            if (policy.applyTo.modes !== undefined) validateStringArray(policy.applyTo.modes, `${label}.applyTo.modes`, errors);
            if (policy.applyTo.modelIncludes !== undefined) validateStringArray(policy.applyTo.modelIncludes, `${label}.applyTo.modelIncludes`, errors);
            if (policy.applyTo.urlIncludes !== undefined) validateStringArray(policy.applyTo.urlIncludes, `${label}.applyTo.urlIncludes`, errors);
        }
    }

    if (policy.promptFragments !== undefined) {
        validatePromptFragments(policy.promptFragments, `${label}.promptFragments`, errors);
    }

    if (policy.requestPatch !== undefined) {
        assert(isObject(policy.requestPatch), `${label}.requestPatch must be an object`, errors);
    }

    if (policy.retry !== undefined) {
        assert(isObject(policy.retry), `${label}.retry must be an object`, errors);
        if (isObject(policy.retry) && policy.retry.onErrorCodes !== undefined) {
            validateStringArray(policy.retry.onErrorCodes, `${label}.retry.onErrorCodes`, errors);
        }
    }

    if (policy.cancel !== undefined) {
        assert(isObject(policy.cancel), `${label}.cancel must be an object`, errors);
        if (isObject(policy.cancel) && policy.cancel.draftIncludes !== undefined) {
            validateStringArray(policy.cancel.draftIncludes, `${label}.cancel.draftIncludes`, errors);
        }
    }

    const hasPromptFragments = policy.promptFragments !== undefined;
    const hasRequestPatch = isObject(policy.requestPatch) && Object.keys(policy.requestPatch).length > 0;
    const hasRetry = isObject(policy.retry) && Array.isArray(policy.retry.onErrorCodes) && policy.retry.onErrorCodes.length > 0;
    const hasCancel = isObject(policy.cancel) && (
        (typeof policy.cancel.draftMatches === 'string' && policy.cancel.draftMatches.trim().length > 0) ||
        (Array.isArray(policy.cancel.draftIncludes) && policy.cancel.draftIncludes.length > 0)
    );

    assert(
        hasPromptFragments || hasRequestPatch || hasRetry || hasCancel,
        `${label} needs promptFragments, requestPatch, retry, or cancel`,
        errors
    );
}

function validatePageExtractor(extractor, label, errors) {
    assert(isObject(extractor), `${label} must be an object`, errors);
    if (!isObject(extractor)) {
        return;
    }

    if (extractor.matches !== undefined) validateStringArray(extractor.matches, `${label}.matches`, errors);
    if (extractor.includeSelectors !== undefined) validateStringArray(extractor.includeSelectors, `${label}.includeSelectors`, errors);
    if (extractor.excludeSelectors !== undefined) validateStringArray(extractor.excludeSelectors, `${label}.excludeSelectors`, errors);
    if (extractor.strategy !== undefined) {
        assert(
            extractorStrategies.has(String(extractor.strategy).trim()),
            `${label}.strategy must be replace, prepend, or append`,
            errors
        );
    }
}

function validateShellExecute(execute, label, errors) {
    assert(isObject(execute), `${label} must be an object`, errors);
    if (!isObject(execute)) {
        return;
    }

    const type = String(execute.type ?? '').trim();
    assert(shellExecuteTypes.has(type), `${label}.type is invalid`, errors);

    if (type === 'import_text' || type === 'insert_text' || type === 'set_draft') {
        const text = String(execute.text ?? execute.prompt ?? execute.template ?? '').trim();
        assert(text.length > 0, `${label} requires text, prompt, or template`, errors);
    }

    if (type === 'show_toast') {
        const message = String(execute.message ?? execute.text ?? '').trim();
        assert(message.length > 0, `${label} requires message or text`, errors);
    }

    if (type === 'open_page') {
        assert(isObject(execute.page), `${label} requires page`, errors);
    }
}

function validateSelectionAction(action, label, errors) {
    assert(isObject(action), `${label} must be an object`, errors);
    if (!isObject(action)) {
        return;
    }

    assert(String(action.label ?? '').trim().length > 0, `${label}.label is required`, errors);
    const prompt = String(action.prompt ?? action.text ?? action.promptTemplate ?? '').trim();
    assert(prompt.length > 0, `${label} requires prompt, text, or promptTemplate`, errors);
}

function validateInputAction(action, label, errors) {
    assert(isObject(action), `${label} must be an object`, errors);
    if (!isObject(action)) {
        return;
    }

    const labelValue = String(action.label ?? '').trim();
    const icon = String(action.icon ?? '').trim();
    assert(labelValue.length > 0 || icon.length > 0, `${label} needs label or icon`, errors);
    validateShellExecute(action.execute, `${label}.execute`, errors);
}

function validateMenuItem(item, label, errors) {
    assert(isObject(item), `${label} must be an object`, errors);
    if (!isObject(item)) {
        return;
    }

    assert(String(item.label ?? '').trim().length > 0, `${label}.label is required`, errors);
    if (item.iconPlacement !== undefined) {
        const iconPlacement = String(item.iconPlacement).trim();
        assert(
            iconPlacement === 'leading' || iconPlacement === 'disclosure',
            `${label}.iconPlacement must be leading or disclosure`,
            errors
        );
    }
    validateShellExecute(item.execute, `${label}.execute`, errors);
}

function validateSlashCommand(command, label, errors) {
    assert(isObject(command), `${label} must be an object`, errors);
    if (!isObject(command)) {
        return;
    }

    assert(String(command.name ?? '').trim().length > 0, `${label}.name is required`, errors);
    const prompt = String(command.prompt ?? command.text ?? command.template ?? '').trim();
    assert(prompt.length > 0, `${label} requires prompt, text, or template`, errors);
    if (command.aliases !== undefined) {
        validateStringArray(command.aliases, `${label}.aliases`, errors);
    }
}

function validateContributions(contributions, scope, label, errors) {
    assert(isObject(contributions), `${label} must be an object`, errors);
    if (!isObject(contributions)) {
        return;
    }

    const presentKeys = Object.keys(contributions).filter((key) => contributions[key] !== undefined);
    presentKeys.forEach((key) => {
        assert(contributionTypes.has(key), `${label}.${key} is not a supported contribution type`, errors);
    });

    let totalCount = 0;

    if (contributions.promptFragments !== undefined) {
        validatePromptFragments(contributions.promptFragments, `${label}.promptFragments`, errors);
        totalCount += Array.isArray(contributions.promptFragments) ? contributions.promptFragments.length : 1;
    }

    if (contributions.requestPolicies !== undefined) {
        assert(Array.isArray(contributions.requestPolicies), `${label}.requestPolicies must be an array`, errors);
        if (Array.isArray(contributions.requestPolicies)) {
            totalCount += contributions.requestPolicies.length;
            contributions.requestPolicies.forEach((policy, index) => {
                validateRequestPolicy(policy, `${label}.requestPolicies[${index}]`, errors);
            });
        }
    }

    if (contributions.pageExtractors !== undefined) {
        assert(Array.isArray(contributions.pageExtractors), `${label}.pageExtractors must be an array`, errors);
        if (Array.isArray(contributions.pageExtractors)) {
            totalCount += contributions.pageExtractors.length;
            contributions.pageExtractors.forEach((extractor, index) => {
                validatePageExtractor(extractor, `${label}.pageExtractors[${index}]`, errors);
            });
        }
    }

    if (contributions.selectionActions !== undefined) {
        assert(Array.isArray(contributions.selectionActions), `${label}.selectionActions must be an array`, errors);
        if (Array.isArray(contributions.selectionActions)) {
            totalCount += contributions.selectionActions.length;
            contributions.selectionActions.forEach((action, index) => {
                validateSelectionAction(action, `${label}.selectionActions[${index}]`, errors);
            });
        }
    }

    if (contributions.inputActions !== undefined) {
        assert(Array.isArray(contributions.inputActions), `${label}.inputActions must be an array`, errors);
        if (Array.isArray(contributions.inputActions)) {
            totalCount += contributions.inputActions.length;
            contributions.inputActions.forEach((action, index) => {
                validateInputAction(action, `${label}.inputActions[${index}]`, errors);
            });
        }
    }

    if (contributions.menuItems !== undefined) {
        assert(Array.isArray(contributions.menuItems), `${label}.menuItems must be an array`, errors);
        if (Array.isArray(contributions.menuItems)) {
            totalCount += contributions.menuItems.length;
            contributions.menuItems.forEach((item, index) => {
                validateMenuItem(item, `${label}.menuItems[${index}]`, errors);
            });
        }
    }

    if (contributions.slashCommands !== undefined) {
        assert(Array.isArray(contributions.slashCommands), `${label}.slashCommands must be an array`, errors);
        if (Array.isArray(contributions.slashCommands)) {
            totalCount += contributions.slashCommands.length;
            contributions.slashCommands.forEach((command, index) => {
                validateSlashCommand(command, `${label}.slashCommands[${index}]`, errors);
            });
        }
    }

    if ((contributions.promptFragments !== undefined || contributions.requestPolicies !== undefined) && scope !== 'shell' && scope !== 'prompt') {
        errors.push(`${label}: prompt contributions must target shell or prompt`);
    }
    if ((contributions.requestPolicies !== undefined || contributions.inputActions !== undefined || contributions.menuItems !== undefined || contributions.slashCommands !== undefined) && scope !== 'shell') {
        errors.push(`${label}: shell contributions must target shell`);
    }
    if ((contributions.pageExtractors !== undefined || contributions.selectionActions !== undefined) && scope !== 'page') {
        errors.push(`${label}: page contributions must target page`);
    }

    assert(totalCount > 0, `${label} needs at least one contribution`, errors);
}

function validateLegacyDeclarative(declarative, scope, label, errors) {
    assert(isObject(declarative), `${label} must be an object`, errors);
    if (!isObject(declarative)) {
        return;
    }

    const type = String(declarative.type ?? '').trim();
    assert(legacyDeclarativeTypes.has(type), `${label}.type is invalid`, errors);

    if (type === 'prompt_fragment') {
        assert(scope === 'prompt' || scope === 'shell', `${label}: prompt_fragment must target prompt or shell`, errors);
        if (declarative.placement !== undefined) {
            assert(promptPlacements.has(String(declarative.placement).trim()), `${label}.placement is invalid`, errors);
        }
        validatePromptFragments(declarative, label, errors);
    }

    if (type === 'request_policy') {
        assert(scope === 'shell', `${label}: request_policy must target shell`, errors);
        validateRequestPolicy(declarative, label, errors);
    }

    if (type === 'page_extractor') {
        assert(scope === 'page', `${label}: page_extractor must target page`, errors);
        validatePageExtractor(declarative, label, errors);
    }
}

function validatePluginManifest(manifest, filePath) {
    const errors = [];
    const relativeFile = toPosix(path.relative(projectRoot, filePath));

    assert(isObject(manifest), `${relativeFile}: manifest must be an object`, errors);
    if (errors.length > 0) {
        return errors;
    }

    const schemaVersion = Number(manifest.schemaVersion);
    const kind = String(manifest.kind ?? '').trim();
    const scope = String(manifest.scope ?? '').trim();

    assert(schemaVersion === 1 || schemaVersion === 2, `${relativeFile}: schemaVersion must be 1 or 2`, errors);
    assert(String(manifest.id ?? '').trim().length > 0, `${relativeFile}: id is required`, errors);
    assert(String(manifest.version ?? '').trim().length > 0, `${relativeFile}: version is required`, errors);
    assert(pluginKinds.has(kind), `${relativeFile}: unsupported kind "${kind}"`, errors);
    assert(pluginScopes.has(scope), `${relativeFile}: unsupported scope "${scope}"`, errors);
    assert(String(manifest.displayName ?? '').trim().length > 0, `${relativeFile}: displayName is required`, errors);
    assert(String(manifest.description ?? '').trim().length > 0, `${relativeFile}: description is required`, errors);

    if (manifest.activationEvents !== undefined) {
        validateStringArray(manifest.activationEvents, `${relativeFile}: activationEvents`, errors);
    }

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
        const hasLegacyDeclarative = manifest.declarative !== undefined;
        const hasContributions = manifest.contributions !== undefined;
        assert(hasLegacyDeclarative || hasContributions, `${relativeFile}: declarative plugins need declarative or contributions`, errors);

        if (hasLegacyDeclarative) {
            validateLegacyDeclarative(manifest.declarative, scope, `${relativeFile}: declarative`, errors);
        }

        if (hasContributions) {
            validateContributions(manifest.contributions, scope, `${relativeFile}: contributions`, errors);
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

        if (entry.activationEvents !== undefined) {
            validateStringArray(entry.activationEvents, `${label}.activationEvents`, errors);
        }

        if (entry.contributionTypes !== undefined) {
            validateStringArray(entry.contributionTypes, `${label}.contributionTypes`, errors);
            (entry.contributionTypes || []).forEach((type, typeIndex) => {
                assert(
                    contributionTypes.has(String(type).trim()),
                    `${label}.contributionTypes[${typeIndex}] is invalid`,
                    errors
                );
            });
        }

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
                    errors.push(...validatePluginManifest(manifest, packagePath));
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
