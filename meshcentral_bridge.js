module.exports.meshcentral_bridge = function (parent) {
    const obj = {};

    function shallowShape(value) {
        if (value === null || value === undefined) {
            return value;
        }

        if (Array.isArray(value)) {
            return {
                type: 'array',
                length: value.length,
                sampleKeys: value.length > 0 && typeof value[0] === 'object'
                    ? Object.keys(value[0]).slice(0, 30)
                    : null
            };
        }

        if (typeof value === 'object') {
            const result = {};

            for (const key of Object.keys(value).slice(0, 50)) {
                const child = value[key];

                if (Array.isArray(child)) {
                    result[key] = {
                        type: 'array',
                        length: child.length,
                        sampleKeys: child.length > 0 && typeof child[0] === 'object'
                            ? Object.keys(child[0]).slice(0, 30)
                            : null
                    };
                } else if (child !== null && typeof child === 'object') {
                    result[key] = {
                        type: 'object',
                        keys: Object.keys(child).slice(0, 30)
                    };
                } else {
                    result[key] = typeof child;
                }
            }

            return result;
        }

        return typeof value;
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
                connectTime: agent?.connectTime ?? null
            })
        );
    };

    obj.hook_processAgentData = function (data, agent) {
        if (data?.action === 'sysinfo') {
            console.log(
                '[meshcentral_bridge] sysinfo',
                JSON.stringify({
                    device: agent?.name ?? null,
                    time: data?.data?.time ?? null,
                    hardware: shallowShape(data?.data?.hardware)
                })
            );

            return;
        }

        if (data?.action === 'coreinfo') {
            console.log(
                '[meshcentral_bridge] coreinfo',
                JSON.stringify({
                    device: agent?.name ?? null,
                    osdesc: data?.osdesc ?? null,
                    lastbootuptime: data?.lastbootuptime ?? null,
                    caps: data?.caps ?? null
                })
            );
        }
    };

    return obj;
};