module.exports.pattern_bridge = function (parent) {
    const obj = {};

    obj.server_startup = function () {
        console.log('[pattern_bridge] server_startup');
    };

    obj.hook_agentCoreIsStable = function () {
        console.log('[pattern_bridge] hook_agentCoreIsStable', arguments);
    };

    obj.hook_processAgentData = function () {
        console.log('[pattern_bridge] hook_processAgentData', arguments);
    };

    return obj;
};
