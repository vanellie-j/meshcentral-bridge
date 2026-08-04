module.exports.meshcentral_bridge = function (parent) {
    const obj = {};

    obj.server_startup = function () {
        console.log('[meshcentral_bridge] server_startup');
    };

    obj.hook_agentCoreIsStable = function () {
        console.log('[meshcentral_bridge] hook_agentCoreIsStable', arguments);
    };

    obj.hook_processAgentData = function () {
        console.log('[meshcentral_bridge] hook_processAgentData', arguments);
    };

    return obj;
};
