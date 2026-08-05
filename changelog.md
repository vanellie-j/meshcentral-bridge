# Changelog

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
