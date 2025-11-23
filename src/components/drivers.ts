import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import GLib from '@girs/glib-2.0';
import { UtilsService } from '../services/utils-service';

interface DriverInfo {
  name: string;
  description: string;
  version?: string;
  used?: string;
}

export class DriversComponent {
  private container: Gtk.Box;
  private kernelDriversGroup!: Adw.PreferencesGroup;
  private graphicsDriversGroup!: Adw.PreferencesGroup;
  private networkDriversGroup!: Adw.PreferencesGroup;
  private storageDriversGroup!: Adw.PreferencesGroup;
  private audioDriversGroup!: Adw.PreferencesGroup;
  private usbDriversGroup!: Adw.PreferencesGroup;
  private utils: UtilsService;
  private updateTimeoutId: number | null = null;

  constructor() {
    this.utils = UtilsService.instance;
    const builder = Gtk.Builder.new();
    
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.ObisionStatus/ui/drivers.ui');
      } catch (e) {
        builder.add_from_file('data/ui/drivers.ui');
      }
    } catch (e) {
      console.error('Could not load drivers.ui:', e);
      this.container = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
      });
      return;
    }

    this.container = builder.get_object('drivers_container') as Gtk.Box;
    this.kernelDriversGroup = builder.get_object('kernel_drivers_group') as Adw.PreferencesGroup;
    this.graphicsDriversGroup = builder.get_object('graphics_drivers_group') as Adw.PreferencesGroup;
    this.networkDriversGroup = builder.get_object('network_drivers_group') as Adw.PreferencesGroup;
    this.storageDriversGroup = builder.get_object('storage_drivers_group') as Adw.PreferencesGroup;
    this.audioDriversGroup = builder.get_object('audio_drivers_group') as Adw.PreferencesGroup;
    this.usbDriversGroup = builder.get_object('usb_drivers_group') as Adw.PreferencesGroup;
    
    // Load drivers
    this.loadDrivers();
    
    // Auto-refresh every 10 seconds
    this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, () => {
      this.loadDrivers();
      return GLib.SOURCE_CONTINUE;
    });
  }

  private loadDrivers(): void {
    // Clear existing rows
    this.clearGroup(this.graphicsDriversGroup);
    this.clearGroup(this.networkDriversGroup);
    this.clearGroup(this.storageDriversGroup);
    this.clearGroup(this.audioDriversGroup);
    this.clearGroup(this.usbDriversGroup);
    this.clearGroup(this.kernelDriversGroup);

    // Load graphics drivers
    this.loadGraphicsDrivers();
    
    // Load network drivers
    this.loadNetworkDrivers();
    
    // Load storage drivers
    this.loadStorageDrivers();
    
    // Load audio drivers
    this.loadAudioDrivers();
    
    // Load USB drivers
    this.loadUSBDrivers();
    
    // Load top kernel modules
    this.loadKernelModules();
  }

  private clearGroup(group: Adw.PreferencesGroup): void {
    let child = group.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      if (child instanceof Adw.ActionRow) {
        group.remove(child);
      }
      child = next;
    }
  }

  private addDriverRow(group: Adw.PreferencesGroup, driver: DriverInfo): void {
    const row = new Adw.ActionRow({
      title: driver.name,
      subtitle: driver.description,
    });
    
    if (driver.version) {
      const versionLabel = new Gtk.Label({
        label: driver.version,
        css_classes: ['dim-label', 'caption'],
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
      });
      row.add_suffix(versionLabel);
    }
    
    if (driver.used) {
      const usedLabel = new Gtk.Label({
        label: `Used: ${driver.used}`,
        css_classes: ['dim-label', 'caption'],
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
      });
      row.add_suffix(usedLabel);
    }
    
    group.add(row);
  }

  private loadGraphicsDrivers(): void {
    try {
      // Get GPU info from lspci
      const [lspciOut] = this.utils.executeCommand('lspci', ['-k']);
      const lines = lspciOut.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('VGA') || line.includes('3D') || line.includes('Display')) {
          const deviceName = line.split(':').slice(2).join(':').trim();
          let driver = 'Unknown';
          let version = '';
          
          // Look for kernel driver in use
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            if (lines[j].includes('Kernel driver in use:')) {
              driver = lines[j].split(':')[1].trim();
              
              // Try to get version
              try {
                const [modInfoOut] = this.utils.executeCommand('modinfo', [driver]);
                const versionLine = modInfoOut.split('\n').find(l => l.includes('version:'));
                if (versionLine) {
                  version = versionLine.split(':')[1].trim();
                }
              } catch (e) {
                // Ignore if modinfo fails
              }
              break;
            }
          }
          
          this.addDriverRow(this.graphicsDriversGroup, {
            name: driver,
            description: deviceName,
            version: version || undefined,
          });
        }
      }
    } catch (error) {
      console.error('Error loading graphics drivers:', error);
    }
  }

  private loadNetworkDrivers(): void {
    try {
      const [lspciOut] = this.utils.executeCommand('lspci', ['-k']);
      const lines = lspciOut.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('Network') || line.includes('Ethernet') || line.includes('Wireless')) {
          const deviceName = line.split(':').slice(2).join(':').trim();
          let driver = 'Unknown';
          let version = '';
          
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            if (lines[j].includes('Kernel driver in use:')) {
              driver = lines[j].split(':')[1].trim();
              
              try {
                const [modInfoOut] = this.utils.executeCommand('modinfo', [driver]);
                const versionLine = modInfoOut.split('\n').find(l => l.includes('version:'));
                if (versionLine) {
                  version = versionLine.split(':')[1].trim();
                }
              } catch (e) {
                // Ignore
              }
              break;
            }
          }
          
          this.addDriverRow(this.networkDriversGroup, {
            name: driver,
            description: deviceName,
            version: version || undefined,
          });
        }
      }
    } catch (error) {
      console.error('Error loading network drivers:', error);
    }
  }

  private loadStorageDrivers(): void {
    try {
      const [lspciOut] = this.utils.executeCommand('lspci', ['-k']);
      const lines = lspciOut.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('SATA') || line.includes('RAID') || line.includes('NVMe') || 
            line.includes('IDE') || line.includes('SCSI') || line.includes('Mass storage')) {
          const deviceName = line.split(':').slice(2).join(':').trim();
          let driver = 'Unknown';
          let version = '';
          
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            if (lines[j].includes('Kernel driver in use:')) {
              driver = lines[j].split(':')[1].trim();
              
              try {
                const [modInfoOut] = this.utils.executeCommand('modinfo', [driver]);
                const versionLine = modInfoOut.split('\n').find(l => l.includes('version:'));
                if (versionLine) {
                  version = versionLine.split(':')[1].trim();
                }
              } catch (e) {
                // Ignore
              }
              break;
            }
          }
          
          this.addDriverRow(this.storageDriversGroup, {
            name: driver,
            description: deviceName,
            version: version || undefined,
          });
        }
      }
    } catch (error) {
      console.error('Error loading storage drivers:', error);
    }
  }

  private loadAudioDrivers(): void {
    try {
      const [lspciOut] = this.utils.executeCommand('lspci', ['-k']);
      const lines = lspciOut.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('Audio') || line.includes('Sound') || line.includes('Multimedia')) {
          const deviceName = line.split(':').slice(2).join(':').trim();
          let driver = 'Unknown';
          let version = '';
          
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            if (lines[j].includes('Kernel driver in use:')) {
              driver = lines[j].split(':')[1].trim();
              
              try {
                const [modInfoOut] = this.utils.executeCommand('modinfo', [driver]);
                const versionLine = modInfoOut.split('\n').find(l => l.includes('version:'));
                if (versionLine) {
                  version = versionLine.split(':')[1].trim();
                }
              } catch (e) {
                // Ignore
              }
              break;
            }
          }
          
          this.addDriverRow(this.audioDriversGroup, {
            name: driver,
            description: deviceName,
            version: version || undefined,
          });
        }
      }
    } catch (error) {
      console.error('Error loading audio drivers:', error);
    }
  }

  private loadUSBDrivers(): void {
    try {
      const [lspciOut] = this.utils.executeCommand('lspci', ['-k']);
      const lines = lspciOut.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('USB')) {
          const deviceName = line.split(':').slice(2).join(':').trim();
          let driver = 'Unknown';
          let version = '';
          
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            if (lines[j].includes('Kernel driver in use:')) {
              driver = lines[j].split(':')[1].trim();
              
              try {
                const [modInfoOut] = this.utils.executeCommand('modinfo', [driver]);
                const versionLine = modInfoOut.split('\n').find(l => l.includes('version:'));
                if (versionLine) {
                  version = versionLine.split(':')[1].trim();
                }
              } catch (e) {
                // Ignore
              }
              break;
            }
          }
          
          this.addDriverRow(this.usbDriversGroup, {
            name: driver,
            description: deviceName,
            version: version || undefined,
          });
        }
      }
    } catch (error) {
      console.error('Error loading USB drivers:', error);
    }
  }

  private loadKernelModules(): void {
    try {
      // Get top loaded modules by usage
      const [lsmodOut] = this.utils.executeCommand('lsmod', []);
      const lines = lsmodOut.split('\n').slice(1); // Skip header
      
      // Parse and sort by used count
      const modules: { name: string; size: string; used: string; by: string }[] = [];
      
      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          modules.push({
            name: parts[0],
            size: parts[1],
            used: parts[2],
            by: parts.slice(3).join(' '),
          });
        }
      }
      
      // Sort by usage (convert to number)
      modules.sort((a, b) => parseInt(b.used) - parseInt(a.used));
      
      // Show top 10 most used modules
      for (let i = 0; i < Math.min(10, modules.length); i++) {
        const module = modules[i];
        
        let version = '';
        try {
          const [modInfoOut] = this.utils.executeCommand('modinfo', [module.name]);
          const versionLine = modInfoOut.split('\n').find(l => l.includes('version:'));
          if (versionLine) {
            version = versionLine.split(':')[1].trim();
          }
        } catch (e) {
          // Ignore
        }
        
        this.addDriverRow(this.kernelDriversGroup, {
          name: module.name,
          description: `Size: ${module.size} bytes` + (module.by ? ` | Used by: ${module.by}` : ''),
          version: version || undefined,
          used: module.used,
        });
      }
    } catch (error) {
      console.error('Error loading kernel modules:', error);
    }
  }

  public getWidget(): Gtk.Box {
    return this.container;
  }

  public destroy(): void {
    if (this.updateTimeoutId !== null) {
      GLib.source_remove(this.updateTimeoutId);
      this.updateTimeoutId = null;
    }
  }
}
