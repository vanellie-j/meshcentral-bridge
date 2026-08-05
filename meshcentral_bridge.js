module.exports.meshcentral_bridge = function (parent) {
    const obj = {};
    const seenActions = new Set();
    const sampleIntervalMs = 60000;
    const webhookTimeoutMs = 10000;
    const webhookUrlText = process.env.MESHCENTRAL_BRIDGE_N8N_WEBHOOK_URL?.trim() ?? '';
    const webhookToken = process.env.MESHCENTRAL_BRIDGE_N8N_TOKEN?.trim() ?? '';
    let webhookUrl = null;
    let webhookConfigError = null;
    let serverRef = null;
    let samplerTimer = null;

    if (webhookUrlText) {
        try {
            webhookUrl = new URL(webhookUrlText);

            if (webhookUrl.protocol !== 'http:' && webhookUrl.protocol !== 'https:') {
                throw new Error('webhook URL must use http or https');
            }
        } catch (error) {
            webhookConfigError = error instanceof Error ? error.message : String(error);
        }
    }

    function sanitizeIdentifiers(identifiers) {
        if (!identifiers || typeof identifiers !== 'object') return null;

        return {
            bios_vendor: identifiers.bios_vendor ?? null,
            firmware_date: identifiers.bios_date ?? null,
            serial: identifiers.chassis_serial ??
                identifiers.bios_serial ??
                identifiers.board_serial ??
                null,
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

    function sanitizeWindowsOsInfo(osinfo) {
        if (!osinfo || typeof osinfo !== 'object') return null;

        return {
            architecture: osinfo.OSArchitecture ?? null
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
            memory_type: item?.MemoryType ?? null,
            smbios_memory_type: item?.SMBIOSMemoryType ?? null,
            form_factor: item?.FormFactor ?? null,
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
            cores: item?.NumberOfCores ?? null,
            logical_processors: item?.NumberOfLogicalProcessors ?? null,
            socket: item?.SocketDesignation ?? null
        }));
    }

    function sanitizeWindowsGpu(gpu) {
        if (!Array.isArray(gpu)) return [];

        return gpu.map((item) => ({
            name: item?.Name ?? null,
            current_horizontal_resolution: item?.CurrentHorizontalResolution ?? null,
            current_vertical_resolution: item?.CurrentVerticalResolution ?? null
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

    function postEvent(event, payload) {
        if (!webhookUrl) return;

        const body = JSON.stringify({
            event,
            source: 'meshcentral_bridge',
            version: '0.0.13',
            ...payload
        });
        const client = webhookUrl.protocol === 'https:'
            ? require('https')
            : require('http');
        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        };

        if (webhookToken) {
            headers.Authorization = `Bearer ${webhookToken}`;
        }

        const request = client.request(webhookUrl, {
            method: 'POST',
            headers
        }, (response) => {
            response.resume();

            if (response.statusCode < 200 || response.statusCode >= 300) {
                console.log(
                    '[meshcentral_bridge] webhook-response-error',
                    JSON.stringify({
                        event,
                        device: payload.device,
                        status: response.statusCode ?? null
                    })
                );
            }
        });

        request.setTimeout(webhookTimeoutMs, () => {
            request.destroy(new Error('webhook request timed out'));
        });

        request.on('error', (error) => {
            console.log(
                '[meshcentral_bridge] webhook-request-error',
                JSON.stringify({
                    event,
                    device: payload.device,
                    error: error instanceof Error ? error.message : String(error)
                })
            );
        });

        request.end(body);
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

        if (webhookConfigError) {
            console.log(
                '[meshcentral_bridge] webhook-config-error',
                JSON.stringify({ error: webhookConfigError })
            );
        } else {
            console.log(
                '[meshcentral_bridge] webhook',
                JSON.stringify({ enabled: webhookUrl !== null })
            );
        }
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
                payload.os = sanitizeWindowsOsInfo(hardware.windows?.osinfo);
                payload.memory = sanitizeWindowsMemory(hardware.windows?.memory);
                payload.cpu = sanitizeWindowsCpu(hardware.windows?.cpu);
                payload.gpu = sanitizeWindowsGpu(hardware.windows?.gpu);
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
                JSON.stringify({
                    device: payload.device,
                    time: payload.time,
                    platform: payload.platform,
                    cpu_count: Array.isArray(payload.cpu) ? payload.cpu.length : null,
                    gpu_count: Array.isArray(payload.gpu) ? payload.gpu.length : null,
                    drive_count: Array.isArray(payload.drives) ? payload.drives.length : null,
                    memory_module_count: Array.isArray(payload.memory) ? payload.memory.length : null,
                    volume_count: Array.isArray(payload.volumes)
                        ? payload.volumes.length
                        : payload.volumes && typeof payload.volumes === 'object'
                            ? Object.keys(payload.volumes).length
                            : null
                })
            );

            const webhookPayload = { ...payload };
            delete webhookPayload.nodeid;
            postEvent('inventory', webhookPayload);

            return;
        }

        if (data?.action === 'coreinfo') {
            const payload = {
                device: agent?.name ?? null,
                nodeid: agent?.nodeid ?? null,
                time: Date.now(),
                osdesc: data?.osdesc ?? null,
                lastbootuptime: data?.lastbootuptime ?? null,
                caps: data?.caps ?? null
            };

            console.log(
                '[meshcentral_bridge] coreinfo',
                JSON.stringify(payload)
            );

            const webhookPayload = { ...payload };
            delete webhookPayload.nodeid;
            postEvent('coreinfo', webhookPayload);

            return;
        }

        if (data?.action === 'battery') {
            const payload = {
                device: agent?.name ?? null,
                nodeid: agent?.nodeid ?? null,
                time: Date.now(),
                state: data?.state ?? null,
                level: data?.level ?? null
            };

            console.log(
                '[meshcentral_bridge] battery',
                JSON.stringify(payload)
            );

            const webhookPayload = { ...payload };
            delete webhookPayload.nodeid;
            postEvent('battery', webhookPayload);

            return;
        }

        if (data?.action === 'msg' && data?.type === 'cpuinfo') {
            const payload = {
                device: agent?.name ?? null,
                time: Date.now(),
                cpu: normalizeCpu(data?.cpu),
                memory: normalizeMemory(data?.memory),
                thermals: normalizeThermals(data?.thermals)
            };

            console.log(
                '[meshcentral_bridge] telemetry',
                JSON.stringify(payload)
            );
            postEvent('telemetry', payload);

            return;
        }

        if (data?.type === 'ifinfo') return;
        if (data?.action === 'smbios' || data?.action === 'sessions') return;

        summarizeUnknownAction(data, agent);
    };

    return obj;
};
