module.exports.meshcentral_bridge = function (parent) {
    const obj = {};

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
            const hardware = data?.data?.hardware ?? {};
            const platform = hardware.windows ? 'windows' :
                hardware.linux ? 'linux' : 'unknown';

            const payload = {
                device: agent?.name ?? null,
                nodeid: agent?.nodeid ?? null,
                time: data?.data?.time ?? null,
                platform,
                identifiers: hardware.identifiers ?? null
            };

            if (platform === 'windows') {
                payload.memory = hardware.windows?.memory ?? null;
                payload.cpu = hardware.windows?.cpu ?? null;
                payload.drives = hardware.windows?.drives ?? null;
                payload.volumes = hardware.windows?.volumes ?? null;
                payload.battery = hardware.battery ?? null;
            }

            if (platform === 'linux') {
                payload.memory = hardware.linux?.memory ?? null;
                payload.volumes = hardware.linux?.volumes ?? null;
            }

            console.log(
                '[meshcentral_bridge] sysinfo-detail',
                JSON.stringify(payload)
            );

            return;
        }

        if (data?.action === 'coreinfo') {
            console.log(
                '[meshcentral_bridge] coreinfo',
                JSON.stringify({
                    device: agent?.name ?? null,
                    nodeid: agent?.nodeid ?? null,
                    osdesc: data?.osdesc ?? null,
                    lastbootuptime: data?.lastbootuptime ?? null,
                    caps: data?.caps ?? null
                })
            );
        }
    };

    return obj;
};