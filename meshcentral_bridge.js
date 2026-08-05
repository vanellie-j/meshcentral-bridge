module.exports.meshcentral_bridge = function (parent) {
    const obj = {};
    const seenActions = new Set();
    const sampleIntervalMs = 60000;
    let serverRef = null;
    let samplerTimer = null;

    function sanitizeIdentifiers(identifiers) {
        if (!identifiers || typeof identifiers !== 'object') return null;

        return {
            bios_vendor: identifiers.bios_vendor ?? null,
            bios_version: identifiers.bios_version ?? null,
            bios_mode: identifiers.bios_mode ?? null,
            board_name: identifiers.board_name ?? null,
            board_vendor: identifiers.board_vendor ?? null,
            board_version: identifiers.board_version ?? null,
            product_name: identifiers.product_name ?? null,
            cpu_name: identifiers.cpu_name ?? null,
            gpu_name: identifiers.gpu_name ?? null,
            storage_devices: Array.isArray(identifiers.storage_devices)
                ? identifiers.storage_devices.map((device) => ({
                    caption: device?.Caption ?? null,
                    model: device?.Model ?? null,
                    size: device?.Size ?? null
                }))
                : []
        };
    }

    function sanitizeWindowsMemory(memory) {
        if (!Array.isArray(memory)) return [];

        return memory.map((item) => ({
            bank: item?.BankLabel ?? null,
            locator: item?.DeviceLocator ?? null,
            capacity: item?.Capacity ?? null,
            configured_clock_speed: item?.ConfiguredClockSpeed ?? null,
            speed: item?.Speed ?? null,
            manufacturer: item?.Manufacturer ?? null,
            part_number: item?.PartNumber?.trim?.() ?? item?.PartNumber ?? null
        }));
    }

    function sanitizeWindowsCpu(cpu) {
        if (!Array.isArray(cpu)) return [];

        return cpu.map((item) => ({
            manufacturer: item?.Manufacturer ?? null,
            name: item?.Name ?? null,
            max_clock_speed: item?.MaxClockSpeed ?? null,
            socket: item?.SocketDesignation ?? null
        }));
    }

    function sanitizeWindowsDrives(drives) {
        if (!Array.isArray(drives)) return [];

        return drives.map((item) => ({
            caption: item?.Caption ?? null,
            model: item?.Model ?? null,
            partitions: item?.Partitions ?? null,
            size: item?.Size ?? null,
            status: item?.Status ?? null
        }));
    }

    function sanitizeWindowsVolumes(volumes) {
        if (!volumes || typeof volumes !== 'object') return {};

        const result = {};

        for (const [letter, volume] of Object.entries(volumes)) {
            result[letter] = {
                name: volume?.name ?? null,
                type: volume?.type ?? null,
                size: volume?.size ?? null,
                size_remaining: volume?.sizeremaining ?? null,
                volume_status: volume?.volumeStatus ?? null,
                protection_status: volume?.protectionStatus ?? null,
                cdrom: volume?.cdrom ?? false
            };
        }

        return result;
    }

    function sanitizeBattery(battery) {
        if (!Array.isArray(battery)) return [];

        return battery.map((item) => ({
            cycle_count: item?.CycleCount ?? null,
            full_charged_capacity: item?.FullChargedCapacity ?? null,
            designed_capacity: item?.DesignedCapacity ?? null,
            chemistry: item?.Chemistry ?? null,
            manufacturer: item?.ManufactureName ?? null,
            charge_rate: item?.ChargeRate ?? null,
            charging: item?.Charging ?? null,
            discharge_rate: item?.DischargeRate ?? null,
            discharging: item?.Discharging ?? null,
            remaining_capacity: item?.RemainingCapacity ?? null,
            voltage: item?.Voltage ?? null,
            health: item?.Health ?? null,
            charge_percent: item?.BatteryCharge ?? null
        }));
    }

    function sanitizeLinuxMemory(memory) {
        if (!memory || typeof memory !== 'object') return null;

        return {
            physical_memory_array: Array.isArray(memory.Physical_Memory_Array)
                ? memory.Physical_Memory_Array.map((item) => ({
                    location: item?.Location ?? null,
                    use: item?.Use ?? null,
                    error_correction_type: item?.ErrorCorrectionType ?? null,
                    maximum_capacity: item?.MaximumCapacity ?? null
                }))
                : [],
            memory_devices: Array.isArray(memory.Memory_Device)
                ? memory.Memory_Device.map((item) => ({
                    size: item?.Size ?? null,
                    form_factor: item?.FormFactor ?? null,
                    locator: item?.Locator ?? null,
                    type: item?.Type ?? null,
                    manufacturer: item?.Manufacturer ?? null
                }))
                : []
        };
    }

    function sanitizeLinuxVolumes(volumes) {
        if (!Array.isArray(volumes)) return [];

        return volumes.map((volume) => ({
            size: volume?.size ?? null,
            used: volume?.used ?? null,
            available: volume?.available ?? null,
            mount_point: volume?.mount_point ?? null,
            type: volume?.type ?? null
        }));
    }

    function toFiniteNumber(value) {
        if (value === null || value === undefined || value === '') return null;

        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    function normalizeCpu(cpu) {
        const cores = Array.isArray(cpu?.cpus)
            ? cpu.cpus
                .slice(0, 128)
                .map(toFiniteNumber)
                .filter((value) => value !== null)
            : [];

        return {
            total_percent: toFiniteNumber(cpu?.total),
            cores_percent: cores
        };
    }

    function normalizeMemory(memory) {
        const hasWindowsBytes = memory?.MemTotal !== undefined || memory?.MemFree !== undefined;
        const unitMultiplier = hasWindowsBytes ? 1 : 1024;
        const total = toFiniteNumber(hasWindowsBytes ? memory?.MemTotal : memory?.total);
        const free = toFiniteNumber(hasWindowsBytes ? memory?.MemFree : memory?.free);

        return {
            total_bytes: total === null ? null : total * unitMultiplier,
            free_bytes: free === null ? null : free * unitMultiplier,
            used_percent: toFiniteNumber(memory?.percentConsumed)
        };
    }

    function normalizeThermals(thermals) {
        if (!Array.isArray(thermals)) return [];

        return thermals.slice(0, 128).map((thermal) => ({
            name: typeof thermal?.InstanceName === 'string'
                ? thermal.InstanceName
                : null,
            celsius: toFiniteNumber(thermal?.CurrentTemperature)
        }));
    }

    function requestCpuInfo(agent) {
        if (!agent || typeof agent.send !== 'function') return;

        try {
            agent.send(JSON.stringify({ action: 'msg', type: 'cpuinfo' }));
        } catch (error) {
            console.log(
                '[meshcentral_bridge] cpuinfo-request-error',
                JSON.stringify({
                    device: agent?.name ?? null,
                    nodeid: agent?.nodeid ?? null,
                    error: error instanceof Error ? error.message : String(error)
                })
            );
        }
    }

    function startSampler(server) {
        if (server) serverRef = server;
        if (samplerTimer !== null) return;

        samplerTimer = setInterval(() => {
            const agents = serverRef?.wsagents;
            if (!agents || typeof agents !== 'object') return;

            for (const agent of Object.values(agents)) {
                requestCpuInfo(agent);
            }
        }, sampleIntervalMs);
    }

    function summarizeUnknownAction(data, agent) {
        const action = data?.action ?? 'unknown';
        const type = data?.type ?? null;
        const signature = `${action}:${type ?? ''}`;

        if (seenActions.has(signature)) return;
        seenActions.add(signature);

        console.log(
            '[meshcentral_bridge] agent-action',
            JSON.stringify({
                device: agent?.name ?? null,
                action,
                type,
                keys: data && typeof data === 'object' ? Object.keys(data) : [],
                value_type: Array.isArray(data?.value) ? 'array' : typeof data?.value,
                value_keys: data?.value && typeof data.value === 'object'
                    ? Object.keys(data.value).slice(0, 50)
                    : [],
                data_type: Array.isArray(data?.data) ? 'array' : typeof data?.data,
                data_keys: data?.data && typeof data.data === 'object'
                    ? Object.keys(data.data).slice(0, 50)
                    : []
            })
        );
    }

    obj.server_startup = function () {
        console.log('[meshcentral_bridge] server_startup');
    };

    obj.hook_agentCoreIsStable = function (agent, server) {
        startSampler(server);
        requestCpuInfo(agent);

        console.log(
            '[meshcentral_bridge] agent stable',
            JSON.stringify({
                name: agent?.name ?? null,
                nodeid: agent?.nodeid ?? null,
                connectTime: agent?.connectTime ?? null
            })
        );
    };

    obj.hook_processAgentData = function (data, agent, server) {
        if (server) serverRef = server;

        if (data?.action === 'sysinfo') {
            const hardware = data?.data?.hardware ?? {};
            const platform = hardware.windows ? 'windows' :
                hardware.linux ? 'linux' : 'unknown';

            const payload = {
                device: agent?.name ?? null,
                nodeid: agent?.nodeid ?? null,
                time: data?.data?.time ?? null,
                platform,
                identifiers: sanitizeIdentifiers(hardware.identifiers)
            };

            if (platform === 'windows') {
                payload.memory = sanitizeWindowsMemory(hardware.windows?.memory);
                payload.cpu = sanitizeWindowsCpu(hardware.windows?.cpu);
                payload.drives = sanitizeWindowsDrives(hardware.windows?.drives);
                payload.volumes = sanitizeWindowsVolumes(hardware.windows?.volumes);
                payload.battery = sanitizeBattery(hardware.battery);
            }

            if (platform === 'linux') {
                payload.memory = sanitizeLinuxMemory(hardware.linux?.memory);
                payload.volumes = sanitizeLinuxVolumes(hardware.linux?.volumes);
            }

            console.log(
                '[meshcentral_bridge] inventory',
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

            return;
        }

        if (data?.action === 'battery') {
            console.log(
                '[meshcentral_bridge] battery',
                JSON.stringify({
                    device: agent?.name ?? null,
                    nodeid: agent?.nodeid ?? null,
                    state: data?.state ?? null,
                    level: data?.level ?? null
                })
            );

            return;
        }

        if (data?.action === 'msg' && data?.type === 'cpuinfo') {
            console.log(
                '[meshcentral_bridge] telemetry',
                JSON.stringify({
                    device: agent?.name ?? null,
                    time: Date.now(),
                    cpu: normalizeCpu(data?.cpu),
                    memory: normalizeMemory(data?.memory),
                    thermals: normalizeThermals(data?.thermals)
                })
            );

            return;
        }

        if (data?.type === 'ifinfo') return;
        if (data?.action === 'smbios' || data?.action === 'sessions') return;

        summarizeUnknownAction(data, agent);
    };

    return obj;
};
