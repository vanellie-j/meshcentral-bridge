module.exports.meshcentral_bridge = function (parent) {
    const obj = {};

    function summarizeValue(value) {
        if (value === null || value === undefined) {
            return value;
        }

        if (typeof value !== 'object') {
            return value;
        }

        return {
            type: Array.isArray(value) ? 'array' : 'object',
            keys: Object.keys(value).slice(0, 50)
        };
    }

    obj.server_startup = function () {
        console.log('[meshcentral_bridge] server_startup');
    };

    obj.hook_agentCoreIsStable = function (agent) {
        console.log(
            '[meshcentral_bridge] agent stable',
            JSON.stringify({
                name: agent?.name ?? null,
                nodeid: agent?.nodeid ?? null,
                meshid: agent?.meshid ?? null,
                remoteaddr: agent?.remoteaddr ?? null,
                connectTime: agent?.connectTime ?? null
            })
        );
    };

    obj.hook_processAgentData = function (data, agent) {
        console.log(
            '[meshcentral_bridge] agent data',
            JSON.stringify({
                device: {
                    name: agent?.name ?? null,
                    nodeid: agent?.nodeid ?? null,
                    meshid: agent?.meshid ?? null
                },
                message: {
                    action: data?.action ?? null,
                    type: data?.type ?? null,
                    keys: (
                        data !== null &&
                        typeof data === 'object'
                    ) ? Object.keys(data) : null,
                    value: summarizeValue(data?.value),
                    data: summarizeValue(data?.data)
                }
            })
        );
    };

    return obj;
};