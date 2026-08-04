module.exports.meshcentral_bridge = function (parent) {
    const obj = {};

    function inspectArguments(hookName, args) {
        const summary = [];

        for (let i = 0; i < args.length; i++) {
            const value = args[i];

            summary.push({
                index: i,
                type: typeof value,
                constructor: value?.constructor?.name ?? null,
                keys: (
                    value !== null &&
                    typeof value === 'object'
                ) ? Object.keys(value).slice(0, 30) : null
            });
        }

        console.log(
            `[meshcentral_bridge] ${hookName}`,
            JSON.stringify(summary)
        );
    }

    obj.server_startup = function () {
        console.log('[meshcentral_bridge] server_startup');
    };

    obj.hook_agentCoreIsStable = function () {
        inspectArguments('hook_agentCoreIsStable', arguments);
    };

    obj.hook_processAgentData = function () {
        inspectArguments('hook_processAgentData', arguments);
    };

    return obj;
};