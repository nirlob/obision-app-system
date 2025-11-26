# Changelog

## [1.0.0] - 2025-11-26

### Rebranding
- Renamed project from "Obision Status" to "Obysion System"
- Updated application ID from `com.obision.ObisionStatus` to `com.obysion.ObysionSystem`
- Updated GSettings schema ID to `com.obysion.obysion-system`
- Renamed all configuration files:
  - `com.obision.ObisionStatus.gschema.xml` → `com.obysion.ObysionSystem.gschema.xml`
  - `com.obision.ObisionStatus.desktop.in` → `com.obysion.ObysionSystem.desktop.in`
  - `com.obision.ObisionStatus.gresource.xml` → `com.obysion.ObysionSystem.gresource.xml`
  - `bin/obision-status.in` → `bin/obysion-system.in`
- Renamed all icon files to match new branding
- Updated executable name from `obision-status` to `obysion-system`

### New Features
- **Dashboard Component (Resume)**:
  - Circular charts with 70° bottom gap for CPU, GPU, Memory, Disk, and Network
  - CPU temperature monitoring with color-coded display
  - GPU temperature monitoring (supports nvidia-smi and sensors)
  - System load visualization with progress bars (1/5/15 min averages)
  - Top processes list
  - System information summary

- **Settings Persistence**:
  - Window state (width, height, position, maximized) saved across sessions
  - Configurable refresh interval (1-60 seconds)
  - Preferences dialog for easy configuration
  - Dynamic refresh interval updates without restart

- **Settings Service**:
  - GSettings integration for persistent configuration
  - Singleton pattern for easy access
  - Signal connections for reactive updates

### Components
- Resume: Dashboard with circular charts and system overview
- CPU: Detailed CPU information
- GPU: GPU monitoring and information
- Memory: Memory usage and statistics
- Disk: Disk usage and information
- Network: Network interfaces and statistics
- System Info: System information details
- Resources: Resource monitoring
- Processes: Process list and management
- Services: System services management
- Drivers: Driver information
- Logs: System logs viewer

### Technical Improvements
- TypeScript → GJS build system with automatic conversion
- Hybrid build system (npm + Meson)
- GSettings schema compilation in build process
- Proper service module handling in build script
- Dual-path fallback for UI and resource loading (development vs. installed)

### Architecture
- Singleton pattern for services (UtilsService, SettingsService)
- Component-based UI architecture
- GTK4 and Libadwaita integration
- Adaptive layout with responsive sidebar
- Custom CSS styling support

### Documentation
- Updated README.md with new branding and features
- Added comprehensive project structure documentation
- Included troubleshooting guide
- Added development workflow instructions
