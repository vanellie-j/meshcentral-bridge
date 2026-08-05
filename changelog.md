# Changelog

## 0.0.12

- Added canonical system serial, firmware date, memory type, memory form factor, GPU resolution, and future-compatible CPU topology fields to the private inventory webhook.
- Kept serial values out of journal output by replacing full inventory logging with non-sensitive device and item counts.
- Continued explicit allowlisting; raw agent messages, product UUIDs, network data, and recovery secrets remain excluded.
- Preserved existing current-state events and the 60-second telemetry sampler.

## 0.0.11

- Added private webhook delivery for sanitized inventory, core info, and battery events alongside telemetry.
- Added event names to safe webhook delivery errors for easier diagnosis.
- Excluded MeshCentral node identifiers from every webhook payload while preserving existing journal output.
- Kept explicit inventory allowlists and avoided forwarding raw agent messages.

## 0.0.10

- Added optional POST delivery of normalized telemetry to an n8n webhook configured with `MESHCENTRAL_BRIDGE_N8N_WEBHOOK_URL`.
- Added optional bearer authentication through `MESHCENTRAL_BRIDGE_N8N_TOKEN` without logging the token or webhook URL.
- Added a 10-second delivery timeout and safe error summaries containing only the device name, HTTP status, or error message.
- Kept local telemetry logging and the existing immediate and 60-second sampling behavior.

## 0.0.9

- Normalized CPU telemetry to platform-neutral `total_percent` and `cores_percent` fields.
- Normalized Windows byte values and Linux KiB values to `total_bytes` and `free_bytes`, with `used_percent` shared across platforms.
- Reduced thermal telemetry to explicit `name` and `celsius` fields.
- Removed the agent node identifier from telemetry logs and retained the existing safe inventory, core info, battery, and 60-second sampling behavior.

## 0.0.8

- Added safe handling for `msg/cpuinfo` responses, logging only CPU, memory, and thermal telemetry.
- Added a 60-second sampler that requests `cpuinfo` from currently connected MeshCentral agents.
- Added an immediate `cpuinfo` request when an agent core becomes stable.
- Reused MeshCentral's own agent `send()` path rather than emulating a browser session.
- Suppressed all `ifinfo` payloads from discovery logging regardless of action value.

## 0.0.7

- Added explicit safe logging for live battery state and level events.
- Recognized MeshCentral `unknown/ifinfo` network interface events without logging their payload contents.
- Continued one-time shallow discovery logging for previously unseen action/type pairs.

## 0.0.6

- Replaced raw sysinfo logging with an explicit safe-field inventory payload.
- Excluded BitLocker recovery passwords, device identifiers, serial numbers, and other unnecessary sensitive fields from output.
- Added lightweight one-time logging of previously unseen agent action shapes to help identify live CPU and RAM telemetry without logging payload contents.
- Renamed detailed sysinfo output to inventory.

## 0.0.5

- Added detailed sysinfo logging for Windows and Linux devices.
- Added RAM, CPU, drive, volume, battery, and shared hardware identifier output where available.
- Retained coreinfo logging for OS, boot time, and agent capabilities.

## 0.0.1

- Initial diagnostic plugin.
- Added agent connection and agent data hooks.
