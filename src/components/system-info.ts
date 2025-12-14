import Gtk from '@girs/gtk-4.0';
import Adw from '@girs/adw-1';
import { UtilsService } from '../services/utils-service';

export class SystemInfoComponent {
  private container: Gtk.Box;
  private scrolledWindow!: Gtk.ScrolledWindow;
  private utils: UtilsService;
  private authenticateButton!: Gtk.Button;
  private expandCollapseButton!: Gtk.Button;
  private allExpanded: boolean = true;
  private isAuthenticated: boolean = false;
  
  // Category expander rows
  private systemExpander!: Adw.ExpanderRow;
  private hardwareExpander!: Adw.ExpanderRow;
  private softwareExpander!: Adw.ExpanderRow;
  private networkExpander!: Adw.ExpanderRow;

  constructor() {
    this.utils = UtilsService.instance;
    const builder = Gtk.Builder.new();
    
    // Load UI file with fallback
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.ObisionSystem/ui/system-info.ui');
      } catch (e) {
        builder.add_from_file('data/ui/system-info.ui');
      }
    } catch (e) {
      console.error('Could not load system-info.ui:', e);
      this.container = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
      });
      return;
    }
    
    this.container = builder.get_object('system_info_container') as Gtk.Box;
    this.scrolledWindow = builder.get_object('system_info_scrolled') as Gtk.ScrolledWindow;
    this.authenticateButton = builder.get_object('authenticate_button') as Gtk.Button;
    this.expandCollapseButton = builder.get_object('expand_collapse_button') as Gtk.Button;
    
    // Setup button handlers
    this.setupButtons();
    
    // Create category expanders
    this.createCategoryExpanders();
    
    // Load system info
    this.loadSystemInfo();
    
    // Load software info
    this.loadSoftwareInfo();
  }
  
  private setupButtons(): void {
    // Authenticate button
    this.authenticateButton.connect('clicked', () => {
      this.authenticate();
    });
    
    // Expand/Collapse button
    this.expandCollapseButton.connect('clicked', () => {
      this.allExpanded = !this.allExpanded;
      this.systemExpander.set_expanded(this.allExpanded);
      this.hardwareExpander.set_expanded(this.allExpanded);
      this.softwareExpander.set_expanded(this.allExpanded);
      this.networkExpander.set_expanded(this.allExpanded);
      
      // Update icon
      const iconName = this.allExpanded ? 'view-sort-descending-symbolic' : 'view-sort-ascending-symbolic';
      this.expandCollapseButton.set_icon_name(iconName);
    });
  }
  
  private authenticate(): void {
    try {
      // Try to execute a privileged command to verify authentication
      const [stdout, stderr] = this.utils.executeCommand('pkexec', ['true']);
      
      if (stderr === '' || stdout !== '') {
        this.isAuthenticated = true;
        this.authenticateButton.set_sensitive(false);
        this.authenticateButton.set_label('Authenticated');
        
        // Refresh all information
        this.refreshAllInfo();
      }
    } catch (e) {
      console.error('Authentication failed:', e);
      const dialog = new Adw.MessageDialog({
        heading: 'Authentication Failed',
        body: 'Could not authenticate as root user.',
      });
      dialog.add_response('ok', 'OK');
      dialog.present();
    }
  }
  
  private refreshAllInfo(): void {
    // Clear all existing rows from expanders
    this.clearExpanderRows(this.systemExpander);
    this.clearExpanderRows(this.hardwareExpander);
    this.clearExpanderRows(this.softwareExpander);
    this.clearExpanderRows(this.networkExpander);
    
    // Reload all information
    this.loadSystemInfo();
    this.loadNetworkInterfaces();
  }
  
  private clearExpanderRows(expander: Adw.ExpanderRow): void {
    // Remove all child rows
    let child = expander.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      if (child instanceof Adw.ActionRow || child instanceof Adw.ExpanderRow || child instanceof Adw.PreferencesGroup) {
        expander.remove(child);
      }
      child = next;
    }
  }
  
  private createCategoryExpanders(): void {
    const contentBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 0,
    });
    
    const listBox = new Gtk.ListBox({
      selection_mode: Gtk.SelectionMode.NONE,
    });
    listBox.add_css_class('boxed-list');
    
    // System expander
    this.systemExpander = new Adw.ExpanderRow({
      title: 'System',
      subtitle: 'Operating system and kernel information',
      icon_name: 'computer-symbolic',
      expanded: true,
    });
    listBox.append(this.systemExpander);
    
    // Hardware expander
    this.hardwareExpander = new Adw.ExpanderRow({
      title: 'Hardware',
      subtitle: 'CPU, GPU, memory, and storage information',
      icon_name: 'drive-harddisk-solidstate-symbolic',
      expanded: true,
    });
    listBox.append(this.hardwareExpander);
    
    // Software expander
    this.softwareExpander = new Adw.ExpanderRow({
      title: 'Software',
      subtitle: 'Installed packages and development tools',
      icon_name: 'application-x-executable-symbolic',
      expanded: true,
    });
    listBox.append(this.softwareExpander);
    
    // Network expander
    this.networkExpander = new Adw.ExpanderRow({
      title: 'Network',
      subtitle: 'Network interfaces and connectivity',
      icon_name: 'network-wired-symbolic',
      expanded: true,
    });
    listBox.append(this.networkExpander);
    
    // Load network interfaces
    this.loadNetworkInterfaces();
    
    contentBox.append(listBox);
    this.scrolledWindow.set_child(contentBox);
  }

  private loadSystemInfo(): void {
    try {
      const [stdout] = this.utils.executeCommand('fastfetch', ['--format', 'json']);
      const data = JSON.parse(stdout);
      
      // Process each entry from fastfetch
      for (const item of data) {
        if (item.error || item.type === 'Separator' || item.type === 'Title') {
          continue;
        }
        
        const result = item.result;
        let title = '';
        let subtitle = '';
        let icon = '';
        let category: 'system' | 'hardware' | 'software' | 'network' = 'system';
        
        switch (item.type) {
          case 'OS':
            title = 'OS';
            subtitle = result.prettyName || result.name;
            icon = 'computer-symbolic';
            category = 'system';
            break;
          case 'Host':
            title = 'Host';
            subtitle = result.name;
            icon = 'computer-symbolic';
            category = 'system';
            break;
          case 'Kernel':
            title = 'Kernel';
            subtitle = `${result.name} ${result.release}`;
            icon = 'emblem-system-symbolic';
            category = 'system';
            break;
          case 'Uptime':
            title = 'Uptime';
            subtitle = this.formatUptime(result.uptime);
            icon = 'document-open-recent-symbolic';
            category = 'system';
            break;
          case 'Packages':
            title = 'Packages';
            const packages = [];
            if (result.dpkg > 0) packages.push(`${result.dpkg} (dpkg)`);
            if (result.flatpakSystem > 0 || result.flatpakUser > 0) {
              packages.push(`${result.flatpakSystem + result.flatpakUser} (flatpak)`);
            }
            if (result.snap > 0) packages.push(`${result.snap} (snap)`);
            subtitle = packages.join(', ');
            icon = 'package-x-generic-symbolic';
            category = 'system';
            break;
          case 'Shell':
            title = 'Shell';
            subtitle = result.version ? `${result.exeName} ${result.version}` : result.exeName;
            icon = 'utilities-terminal-symbolic';
            category = 'system';
            break;
          case 'Display':
            title = 'Display';
            result.forEach((display: {name: string, output: any}, index: number) => {
              subtitle += `${display.name} - ${display.output.refreshRate ? `${display.output.width}x${display.output.height}@${display.output.refreshRate} Hz` : `${display.output.width}x${display.output.height}`}`;
              if (index < result.length - 1) {
                subtitle += '\n';
              }
            });
            icon = 'video-display-symbolic';
            category = 'hardware';
          break;
          case 'DE':
            title = 'Desktop Environment';
            subtitle = result.version ? `${result.prettyName} ${result.version}` : result.prettyName || result.name;
            icon = 'computer-symbolic';
            category = 'system';
            break;
          case 'WM':
            title = 'Window Manager';
            subtitle = `${result.prettyName} (${result.protocolName})`;
            icon = 'computer-apple-ipad-symbolic';
            category = 'system';
            break;
          case 'Theme':
            title = 'Theme';
            subtitle = result.pretty || result.name;
            icon = 'preferences-desktop-theme-symbolic';
            category = 'system';
            break;
          case 'Icons':
            title = 'Icons';
            subtitle = result.pretty || result.name;
            icon = 'preferences-desktop-icons-symbolic';
            category = 'system';
            break;
          case 'Font':
            if (result.pretty || result.name) {
              title = 'Font';
              subtitle = result.pretty || result.name;
              icon = 'font-x-generic-symbolic';
              category = 'system';
            }
            break;
          case 'Cursor':
            if (result.name) {
              title = 'Cursor';
              subtitle = result.size ? `${result.name} (${result.size}px)` : result.name;
              icon = 'input-mouse-symbolic';
              category = 'system';
            }
            break;
          case 'CPU':
            title = 'CPU';
            subtitle = `${result.cpu} - ${result.cores.physical} physical cores / ${result.cores.logical} logical cores`;
            icon = 'drive-harddisk-solidstate-symbolic';
            category = 'hardware';
            break;
          case 'GPU':
            title = 'GPU';
            if (Array.isArray(result)) {
              result.forEach((gpu: {name: string, vendor: string}, index: number) => {
                subtitle += `${gpu.vendor} ${gpu.name}`;
                if (index < result.length - 1) {
                  subtitle += '\n';
                }
              });
            } else if (result.name) {
              subtitle = `${result.vendor || ''} ${result.name}`.trim();
            }
            icon = 'video-display-symbolic';
            category = 'hardware';
            break;
          case 'Memory':
            title = 'Memory';
            const memPct = result.total !== undefined ? `(${(result.used * 100 / result.total).toFixed(1)}%)` : '';
            subtitle = `${this.utils.formatBytes(result.used || 0)} / ${this.utils.formatBytes(result.total || 0)} ${memPct}`;
            icon = 'auth-sim-symbolic';
            category = 'hardware';
            break;
          case 'Swap':
            // Store swap data to add to mount points later
            (this as any).swapData = result;
            continue;
          case 'Disk':
            // Create PreferencesGroup for mount points
            const mountGroup = new Adw.PreferencesGroup();
            (mountGroup as any).set_margin_start(40);
            (mountGroup as any).set_margin_end(12);
            (mountGroup as any).set_margin_top(6);
            (mountGroup as any).set_margin_bottom(6);
            
            const mountExpander = new Adw.ExpanderRow({
              title: 'Mount points',
              subtitle: `${result.length} mount point${result.length !== 1 ? 's' : ''}`,
              icon_name: 'drive-harddisk-symbolic',
              show_enable_switch: false,
            });
            
            result.forEach((mount: { mountpoint: any; bytes: any; }) => {
              const mountRow = new Adw.ActionRow({
                title: mount.mountpoint,
                subtitle: `${this.utils.formatBytes(mount.bytes.used || 0)} / ${this.utils.formatBytes(mount.bytes.total || 0)}`,
              });
              mountExpander.add_row(mountRow);
            });
            
            // Add swap if available
            const swapData = (this as any).swapData;
            if (swapData) {
              let swapSubtitle = '';
              if (swapData.total > 0) {
                const swapPct = `(${(swapData.used * 100 / swapData.total).toFixed(1)}%)`;
                swapSubtitle = `${this.utils.formatBytes(swapData.used || 0)} / ${this.utils.formatBytes(swapData.total || 0)} ${swapPct}`;
              } else {
                swapSubtitle = 'Not configured';
              }
              const swapRow = new Adw.ActionRow({
                title: 'Swap',
                subtitle: swapSubtitle,
              });
              mountExpander.add_row(swapRow);
            }
            
            mountGroup.add(mountExpander);
            
            // Wrap in a box and listboxrow to add to hardware expander
            const mountWrapper = new Gtk.Box({
              orientation: Gtk.Orientation.VERTICAL,
            });
            mountWrapper.append(mountGroup);
            
            const mountGroupRow = new Gtk.ListBoxRow();
            mountGroupRow.set_child(mountWrapper);
            (mountGroupRow as any).set_activatable(false);
            (mountGroupRow as any).set_selectable(false);
            
            this.hardwareExpander.add_row(mountGroupRow);
            continue;
          case 'LocalIP':
          case 'PublicIP':
          case 'WiFi':
            // Skip - network interfaces are loaded separately
            continue;
          case 'Battery':
            // Battery data comes as an array, take the first battery  
            const batteryArray = Array.isArray(result) ? result : [result];
            if (batteryArray && batteryArray.length > 0) {
              const battery = batteryArray[0];
              const battPct = battery.capacity !== undefined ? `${battery.capacity.toFixed(1)}%` : 'N/A';
              const batteryGroup = new Adw.PreferencesGroup();
              (batteryGroup as any).set_margin_start(40);
              (batteryGroup as any).set_margin_end(12);
              (batteryGroup as any).set_margin_top(6);
              (batteryGroup as any).set_margin_bottom(6);
              
              const batteryExpander = new Adw.ExpanderRow({
                title: 'Battery',
                subtitle: `${battPct} - ${battery.status || 'Unknown'}`,
                icon_name: battery.status && battery.status.includes('Charging') ? 'battery-full-charging-symbolic' : 'battery-symbolic',
                show_enable_switch: false,
              });
              
              // Add battery details
              if (battery.modelName) {
                const modelRow = new Adw.ActionRow({
                  title: 'Model',
                  subtitle: battery.modelName,
                });
                batteryExpander.add_row(modelRow);
              }
              
              if (battery.manufacturer) {
                const mfgRow = new Adw.ActionRow({
                  title: 'Manufacturer',
                  subtitle: battery.manufacturer,
                });
                batteryExpander.add_row(mfgRow);
              }
              
              if (battery.capacity !== undefined) {
                const capacityRow = new Adw.ActionRow({
                  title: 'Capacity',
                  subtitle: `${battery.capacity.toFixed(1)}%`,
                });
                batteryExpander.add_row(capacityRow);
              }
              
              if (battery.status) {
                const statusRow = new Adw.ActionRow({
                  title: 'Status',
                  subtitle: battery.status,
                });
                batteryExpander.add_row(statusRow);
              }
              
              if (battery.technology) {
                const techRow = new Adw.ActionRow({
                  title: 'Technology',
                  subtitle: battery.technology,
                });
                batteryExpander.add_row(techRow);
              }
              
              if (battery.cycleCount !== undefined) {
                const cycleRow = new Adw.ActionRow({
                  title: 'Cycle Count',
                  subtitle: battery.cycleCount.toString(),
                });
                batteryExpander.add_row(cycleRow);
              }
              
              if (battery.voltage !== undefined) {
                const voltageRow = new Adw.ActionRow({
                  title: 'Voltage',
                  subtitle: `${battery.voltage.toFixed(2)} V`,
                });
                batteryExpander.add_row(voltageRow);
              }
              
              if (battery.temperature !== undefined && battery.temperature !== null) {
                const tempRow = new Adw.ActionRow({
                  title: 'Temperature',
                  subtitle: `${battery.temperature.toFixed(1)} °C`,
                });
                batteryExpander.add_row(tempRow);
              }
              
              batteryGroup.add(batteryExpander);
              
              const batteryWrapper = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
              });
              batteryWrapper.append(batteryGroup);
              
              const batteryGroupRow = new Gtk.ListBoxRow();
              batteryGroupRow.set_child(batteryWrapper);
              (batteryGroupRow as any).set_activatable(false);
              (batteryGroupRow as any).set_selectable(false);
              
              this.hardwareExpander.add_row(batteryGroupRow);
            }
            continue;
          case 'Locale':
            title = 'Locale';
            subtitle = result.result;
            icon = 'preferences-desktop-locale-symbolic';
            category = 'system';
            break;
          default:
            continue;
        }
        
        if (title && subtitle) {
          this.addInfoRow(title, subtitle, icon, category);
        }
      }
    } catch (e) {
      console.error('Error loading system info:', e);
    }
  }

  private addInfoRow(title: string, subtitle: string, iconName: string, category: 'system' | 'hardware' | 'software' | 'network'): void {
    const row = new Adw.ActionRow({
      title: title,
      subtitle: subtitle,
    });
    
    // Add left padding instead of icon (icon size is typically 16px + some padding)
    (row as any).set_margin_start(40);
    
    // Add to appropriate category expander
    switch (category) {
      case 'system':
        this.systemExpander.add_row(row);
        break;
      case 'hardware':
        this.hardwareExpander.add_row(row);
        break;
      case 'software':
        this.softwareExpander.add_row(row);
        break;
      case 'network':
        this.networkExpander.add_row(row);
        break;
    }
  }

  private loadNetworkInterfaces(): void {
    try {
      const [stdout, stderr] = this.utils.executeCommand('ip', ['addr', 'show']);
      
      if (stderr && stderr.trim()) {
        console.error('Error executing ip command:', stderr);
      }
      
      // Parse ip addr output
      const interfaces = this.parseIpAddr(stdout);
      
      console.log('Parsed interfaces:', interfaces.length);
      
      if (interfaces.length === 0) {
        const noIfaceRow = new Adw.ActionRow({
          title: 'No interfaces found',
          subtitle: 'Could not detect network interfaces',
        });
        (noIfaceRow as any).set_margin_start(40);
        this.networkExpander.add_row(noIfaceRow);
        return;
      }
      
      // Create a PreferencesGroup for interfaces with a simple label header
      const interfacesGroup = new Adw.PreferencesGroup();
      
      interfacesGroup.set_title('Interfaces');
      interfacesGroup.set_description('');
      (interfacesGroup as any).set_margin_start(40);
      (interfacesGroup as any).set_margin_end(12);
      (interfacesGroup as any).set_margin_top(6);
      (interfacesGroup as any).set_margin_bottom(6);
      
      // Add expander for each interface
      for (const iface of interfaces) {
        console.log('Adding interface:', iface.name);
        
        const ifaceExpander = new Adw.ExpanderRow({
          title: iface.name,
          icon_name: this.getInterfaceIcon(iface.name),
          show_enable_switch: false,
        });
        
        interfacesGroup.add(ifaceExpander);
        
        // Add state as first detail
        if (iface.state) {
          const stateRow = new Adw.ActionRow({
            title: 'State',
            subtitle: iface.state,
          });
          ifaceExpander.add_row(stateRow);
        }
        
        // Add interface details
        if (iface.ipv4) {
          const ipRow = new Adw.ActionRow({
            title: 'IPv4 Address',
            subtitle: iface.ipv4,
          });
          ifaceExpander.add_row(ipRow);
        }
        
        if (iface.ipv6) {
          const ipRow = new Adw.ActionRow({
            title: 'IPv6 Address',
            subtitle: iface.ipv6,
          });
          ifaceExpander.add_row(ipRow);
        }
        
        if (iface.netmask) {
          const maskRow = new Adw.ActionRow({
            title: 'Netmask',
            subtitle: iface.netmask,
          });
          ifaceExpander.add_row(maskRow);
        }
        
        if (iface.mac) {
          const macRow = new Adw.ActionRow({
            title: 'MAC Address',
            subtitle: iface.mac,
          });
          ifaceExpander.add_row(macRow);
        }
        
        if (iface.mtu) {
          const mtuRow = new Adw.ActionRow({
            title: 'MTU',
            subtitle: iface.mtu,
          });
          ifaceExpander.add_row(mtuRow);
        }
        
        if (iface.rx) {
          const rxRow = new Adw.ActionRow({
            title: 'RX bytes',
            subtitle: iface.rx,
          });
          ifaceExpander.add_row(rxRow);
        }
        
        if (iface.tx) {
          const txRow = new Adw.ActionRow({
            title: 'TX bytes',
            subtitle: iface.tx,
          });
          ifaceExpander.add_row(txRow);
        }
      }
      
      // Add the group as a row to network expander instead of set_child
      // Create a wrapper box for the group
      const groupWrapper = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
      });
      groupWrapper.append(interfacesGroup);
      
      const groupRow = new Gtk.ListBoxRow();
      groupRow.set_child(groupWrapper);
      (groupRow as any).set_activatable(false);
      (groupRow as any).set_selectable(false);
      
      this.networkExpander.add_row(groupRow);
      
      // Create a PreferencesGroup for other network info
      const otherNetworkGroup = new Adw.PreferencesGroup();
      
      otherNetworkGroup.set_title('Connectivity');
      otherNetworkGroup.set_description('');
      
      (otherNetworkGroup as any).set_margin_start(40);
      (otherNetworkGroup as any).set_margin_end(12);
      (otherNetworkGroup as any).set_margin_top(6);
      (otherNetworkGroup as any).set_margin_bottom(6);
      
      // Add Firewall information
      this.loadFirewallInfo(otherNetworkGroup);
      
      // Add WiFi information
      this.loadWiFiInfo(otherNetworkGroup);
      
      // Add Ethernet information
      this.loadEthernetInfo(otherNetworkGroup);
      
      // Add DNS information
      this.loadDNSInfo(otherNetworkGroup);
      
      // Add VPN information
      this.loadVPNInfo(otherNetworkGroup);
      
      // Add the other group as a row
      const otherGroupWrapper = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
      });
      otherGroupWrapper.append(otherNetworkGroup);
      
      const otherGroupRow = new Gtk.ListBoxRow();
      otherGroupRow.set_child(otherGroupWrapper);
      (otherGroupRow as any).set_activatable(false);
      (otherGroupRow as any).set_selectable(false);
      
      this.networkExpander.add_row(otherGroupRow);
    } catch (e) {
      console.error('Error loading network interfaces:', e);
    }
  }
  
  private loadFirewallInfo(group: Adw.PreferencesGroup): void {
    try {
      const firewallExpander = new Adw.ExpanderRow({
        title: 'Firewall',
        icon_name: 'security-high-symbolic',
        show_enable_switch: false,
      });
      
      // Try to get firewall status
      let status = 'Unknown';
      let details: string[] = [];
      let needsAuth = false;
      
      try {
        const [stdout, stderr] = this.utils.executeCommand('ufw', ['status']);
        
        if (stderr && (stderr.includes('permission denied') || stderr.includes('ERROR'))) {
          needsAuth = true;
        } else if (stdout.includes('Status: active')) {
          status = 'Active';
          const lines = stdout.split('\n');
          for (const line of lines) {
            if (line.trim() && !line.includes('Status:') && !line.includes('To') && !line.includes('--')) {
              details.push(line.trim());
            }
          }
        } else if (stdout.includes('Status: inactive')) {
          status = 'Inactive';
        }
      } catch (e) {
        // Try firewalld
        try {
          const [stdout2, stderr2] = this.utils.executeCommand('firewall-cmd', ['--state']);
          if (stderr2 && stderr2.includes('authorization')) {
            needsAuth = true;
          } else {
            status = stdout2.trim();
          }
        } catch (e2) {
          status = 'Not available';
        }
      }
      
      if (!this.isAuthenticated && needsAuth) {
        const authRow = new Adw.ActionRow({
          title: 'Authentication Required',
          subtitle: 'Click "Authenticate" button to view firewall information',
        });
        const lockIcon = new Gtk.Image({
          icon_name: 'dialog-password-symbolic',
          css_classes: ['dim-label'],
        });
        authRow.add_suffix(lockIcon);
        firewallExpander.add_row(authRow);
        group.add(firewallExpander);
        return;
      }
      
      const statusRow = new Adw.ActionRow({
        title: 'Status',
        subtitle: status,
      });
      firewallExpander.add_row(statusRow);
      
      if (details.length > 0 && details.length <= 5) {
        for (const detail of details) {
          const row = new Adw.ActionRow({
            title: 'Rule',
            subtitle: detail,
          });
          firewallExpander.add_row(row);
        }
      }
      
      group.add(firewallExpander);
    } catch (e) {
      console.error('Error loading firewall info:', e);
    }
  }
  
  private loadWiFiInfo(group: Adw.PreferencesGroup): void {
    try {
      const wifiExpander = new Adw.ExpanderRow({
        title: 'WiFi',
        icon_name: 'network-wireless-symbolic',
        show_enable_switch: false,
      });
      
      // Try to get WiFi information using nmcli
      try {
        const [stdout] = this.utils.executeCommand('nmcli', ['-t', '-f', 'ACTIVE,SSID,SIGNAL,SECURITY', 'dev', 'wifi']);
        const lines = stdout.split('\n').filter(l => l.trim());
        
        let hasWifi = false;
        for (const line of lines) {
          const parts = line.split(':');
          if (parts.length >= 4 && parts[0] === 'yes') {
            hasWifi = true;
            const ssidRow = new Adw.ActionRow({
              title: 'Connected to',
              subtitle: parts[1] || 'Unknown',
            });
            wifiExpander.add_row(ssidRow);
            
            if (parts[2]) {
              const signalRow = new Adw.ActionRow({
                title: 'Signal Strength',
                subtitle: `${parts[2]}%`,
              });
              wifiExpander.add_row(signalRow);
            }
            
            if (parts[3]) {
              const securityRow = new Adw.ActionRow({
                title: 'Security',
                subtitle: parts[3],
              });
              wifiExpander.add_row(securityRow);
            }
            break;
          }
        }
        
        if (!hasWifi) {
          const noWifiRow = new Adw.ActionRow({
            title: 'Status',
            subtitle: 'Not connected',
          });
          wifiExpander.add_row(noWifiRow);
        }
      } catch (e) {
        const errorRow = new Adw.ActionRow({
          title: 'Status',
          subtitle: 'Information not available',
        });
        wifiExpander.add_row(errorRow);
      }
      
      group.add(wifiExpander);
    } catch (e) {
      console.error('Error loading WiFi info:', e);
    }
  }
  
  private loadEthernetInfo(group: Adw.PreferencesGroup): void {
    try {
      const ethernetExpander = new Adw.ExpanderRow({
        title: 'Ethernet',
        icon_name: 'network-wired-symbolic',
        show_enable_switch: false,
      });
      
      // Try to get Ethernet information using nmcli
      try {
        const [stdout] = this.utils.executeCommand('nmcli', ['-t', '-f', 'DEVICE,TYPE,STATE,CONNECTION', 'dev']);
        const lines = stdout.split('\n').filter(l => l.trim());
        
        let hasEthernet = false;
        for (const line of lines) {
          const parts = line.split(':');
          if (parts.length >= 4 && parts[1] === 'ethernet') {
            hasEthernet = true;
            const deviceRow = new Adw.ActionRow({
              title: 'Device',
              subtitle: parts[0],
            });
            ethernetExpander.add_row(deviceRow);
            
            const stateRow = new Adw.ActionRow({
              title: 'State',
              subtitle: parts[2],
            });
            ethernetExpander.add_row(stateRow);
            
            if (parts[3]) {
              const connectionRow = new Adw.ActionRow({
                title: 'Connection',
                subtitle: parts[3],
              });
              ethernetExpander.add_row(connectionRow);
            }
          }
        }
        
        if (!hasEthernet) {
          const noEthRow = new Adw.ActionRow({
            title: 'Status',
            subtitle: 'No ethernet devices found',
          });
          ethernetExpander.add_row(noEthRow);
        }
      } catch (e) {
        const errorRow = new Adw.ActionRow({
          title: 'Status',
          subtitle: 'Information not available',
        });
        ethernetExpander.add_row(errorRow);
      }
      
      group.add(ethernetExpander);
    } catch (e) {
      console.error('Error loading Ethernet info:', e);
    }
  }
  
  private loadDNSInfo(group: Adw.PreferencesGroup): void {
    try {
      const dnsExpander = new Adw.ExpanderRow({
        title: 'DNS',
        icon_name: 'network-server-symbolic',
        show_enable_switch: false,
      });
      
      // Try to get DNS servers from resolv.conf and systemd-resolve
      try {
        const [stdout] = this.utils.executeCommand('cat', ['/etc/resolv.conf']);
        const lines = stdout.split('\n');
        let ipv4Servers: string[] = [];
        let ipv6Servers: string[] = [];
        let searchDomains: string[] = [];
        let options: string[] = [];
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('nameserver')) {
            const parts = trimmed.split(/\s+/);
            if (parts.length >= 2) {
              const ip = parts[1];
              if (ip.includes(':')) {
                ipv6Servers.push(ip);
              } else {
                ipv4Servers.push(ip);
              }
            }
          } else if (trimmed.startsWith('search')) {
            const domains = trimmed.substring(6).trim().split(/\s+/);
            searchDomains.push(...domains);
          } else if (trimmed.startsWith('options')) {
            const opts = trimmed.substring(7).trim().split(/\s+/);
            options.push(...opts);
          }
        }
        
        if (ipv4Servers.length === 0 && ipv6Servers.length === 0 && searchDomains.length === 0) {
          const noDnsRow = new Adw.ActionRow({
            title: 'Status',
            subtitle: 'No DNS configuration found',
          });
          dnsExpander.add_row(noDnsRow);
        } else {
          // Always show IPv6 row
          const ipv6Row = new Adw.ActionRow({
            title: 'Nameserver IPv6',
            subtitle: ipv6Servers.length > 0 ? ipv6Servers.join(', ') : 'Not configured',
          });
          dnsExpander.add_row(ipv6Row);
          
          // Always show IPv4 row
          const ipv4Row = new Adw.ActionRow({
            title: 'Nameserver IPv4',
            subtitle: ipv4Servers.length > 0 ? ipv4Servers.join(', ') : 'Not configured',
          });
          dnsExpander.add_row(ipv4Row);
          
          // Show search domains
          if (searchDomains.length > 0) {
            const searchRow = new Adw.ActionRow({
              title: 'Search Domains',
              subtitle: searchDomains.join(', '),
            });
            dnsExpander.add_row(searchRow);
          }
          
          // Show options if present
          if (options.length > 0) {
            const optionsRow = new Adw.ActionRow({
              title: 'Options',
              subtitle: options.join(', '),
            });
            dnsExpander.add_row(optionsRow);
          }
        }
      } catch (e) {
        const errorRow = new Adw.ActionRow({
          title: 'Status',
          subtitle: 'Information not available',
        });
        dnsExpander.add_row(errorRow);
      }
      
      group.add(dnsExpander);
    } catch (e) {
      console.error('Error loading DNS info:', e);
    }
  }
  
  private loadVPNInfo(group: Adw.PreferencesGroup): void {
    try {
      const vpnExpander = new Adw.ExpanderRow({
        title: 'VPN',
        icon_name: 'network-vpn-symbolic',
        show_enable_switch: false,
      });
      
      // Try to detect active VPN connections
      try {
        const [stdout] = this.utils.executeCommand('nmcli', ['-t', '-f', 'NAME,TYPE,STATE', 'con', 'show', '--active']);
        const lines = stdout.split('\n').filter(l => l.trim());
        
        let hasVPN = false;
        for (const line of lines) {
          const parts = line.split(':');
          if (parts.length >= 3 && (parts[1].includes('vpn') || parts[1].includes('tun') || parts[1].includes('wireguard'))) {
            hasVPN = true;
            const nameRow = new Adw.ActionRow({
              title: 'Connection',
              subtitle: parts[0],
            });
            vpnExpander.add_row(nameRow);
            
            const typeRow = new Adw.ActionRow({
              title: 'Type',
              subtitle: parts[1],
            });
            vpnExpander.add_row(typeRow);
            
            const stateRow = new Adw.ActionRow({
              title: 'State',
              subtitle: parts[2],
            });
            vpnExpander.add_row(stateRow);
          }
        }
        
        if (!hasVPN) {
          const noVpnRow = new Adw.ActionRow({
            title: 'Status',
            subtitle: 'No active VPN connections',
          });
          vpnExpander.add_row(noVpnRow);
        }
      } catch (e) {
        const errorRow = new Adw.ActionRow({
          title: 'Status',
          subtitle: 'Information not available',
        });
        vpnExpander.add_row(errorRow);
      }
      
      group.add(vpnExpander);
    } catch (e) {
      console.error('Error loading VPN info:', e);
    }
  }
  
  
  private loadSoftwareInfo(): void {
    // Installed packages count
    try {
      let packagesCount = 'Unknown';
      let packageManager = '';
      
      // Try different package managers
      try {
        const [dpkgOut] = this.utils.executeCommand('dpkg', ['-l']);
        const count = dpkgOut.split('\n').filter(line => line.startsWith('ii')).length;
        packagesCount = count.toString();
        packageManager = 'dpkg';
      } catch (e) {
        try {
          const [rpmOut] = this.utils.executeCommand('rpm', ['-qa']);
          const count = rpmOut.split('\n').filter(line => line.trim()).length;
          packagesCount = count.toString();
          packageManager = 'rpm';
        } catch (e2) {
          try {
            const [pacmanOut] = this.utils.executeCommand('pacman', ['-Q']);
            const count = pacmanOut.split('\n').filter(line => line.trim()).length;
            packagesCount = count.toString();
            packageManager = 'pacman';
          } catch (e3) {
            // No package manager found
          }
        }
      }
      
      if (packageManager) {
        this.addInfoRow('Packages', `${packagesCount} (${packageManager})`, 'application-x-addon-symbolic', 'software');
      }
    } catch (e) {
      console.error('Error loading package count:', e);
    }
    
    // Shell
    try {
      const [shellOut] = this.utils.executeCommand('sh', ['-c', 'echo $SHELL']);
      if (shellOut.trim()) {
        const shell = shellOut.trim().split('/').pop() || shellOut.trim();
        this.addInfoRow('Shell', shell, 'utilities-terminal-symbolic', 'software');
      }
    } catch (e) {
      console.error('Error loading shell:', e);
    }
    
    // Python version
    try {
      const [pythonOut] = this.utils.executeCommand('python3', ['--version']);
      if (pythonOut.trim()) {
        const version = pythonOut.replace('Python ', '').trim();
        this.addInfoRow('Python', version, 'application-x-executable-symbolic', 'software');
      }
    } catch (e) {
      // Python not installed
    }
    
    // Node.js version
    try {
      const [nodeOut] = this.utils.executeCommand('node', ['--version']);
      if (nodeOut.trim()) {
        const version = nodeOut.trim().replace('v', '');
        this.addInfoRow('Node.js', version, 'application-x-executable-symbolic', 'software');
      }
    } catch (e) {
      // Node not installed
    }
    
    // GCC version
    try {
      const [gccOut] = this.utils.executeCommand('gcc', ['--version']);
      const firstLine = gccOut.split('\n')[0];
      const match = firstLine.match(/gcc.*?(\d+\.\d+\.\d+)/);
      if (match) {
        this.addInfoRow('GCC', match[1], 'application-x-executable-symbolic', 'software');
      }
    } catch (e) {
      // GCC not installed
    }
    
    // Git version
    try {
      const [gitOut] = this.utils.executeCommand('git', ['--version']);
      const match = gitOut.match(/git version ([\d.]+)/);
      if (match) {
        this.addInfoRow('Git', match[1], 'application-x-executable-symbolic', 'software');
      }
    } catch (e) {
      // Git not installed
    }
    
    // Docker version
    try {
      const [dockerOut] = this.utils.executeCommand('docker', ['--version']);
      const match = dockerOut.match(/Docker version ([\d.]+)/);
      if (match) {
        this.addInfoRow('Docker', match[1], 'application-x-executable-symbolic', 'software');
      }
    } catch (e) {
      // Docker not installed
    }
  }
  
  private parseIpAddr(output: string): Array<{name: string, state?: string, ipv4?: string, ipv6?: string, netmask?: string, mac?: string, mtu?: string, rx?: string, tx?: string}> {
    const interfaces: Array<any> = [];
    let currentIface: any = null;
    
    if (!output || output.trim() === '') {
      console.error('Empty output from ip command');
      return interfaces;
    }
    
    console.log('Parsing ip addr output, length:', output.length);
    
    const lines = output.split('\n');
    console.log('Total lines:', lines.length);
    
    for (const line of lines) {
      // New interface - format: "2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500"
      // Also handle: "2: eth0@if3: <BROADCAST..." for virtual interfaces
      if (line.match(/^\d+:\s+[a-z0-9@]+:/i)) {
        if (currentIface) {
          interfaces.push(currentIface);
        }
        
        const match = line.match(/^\d+:\s+([^:@]+)/);
        if (match) {
          currentIface = {
            name: match[1].trim(),
          };
          console.log('Found interface:', currentIface.name);
        }
        
        // Extract flags
        const flagMatch = line.match(/<([^>]+)>/);
        if (flagMatch) {
          currentIface.state = flagMatch[1].includes('UP') ? 'UP' : 'DOWN';
        }
        
        // Extract MTU
        const mtuMatch = line.match(/mtu (\d+)/);
        if (mtuMatch) {
          currentIface.mtu = mtuMatch[1];
        }
      } else if (currentIface) {
        const trimmed = line.trim();
        
        // MAC address - format: "link/ether 00:11:22:33:44:55"
        if (trimmed.startsWith('link/ether')) {
          const match = trimmed.match(/link\/ether\s+([a-f0-9:]+)/i);
          if (match) {
            currentIface.mac = match[1];
          }
        }
        
        // IPv4 address - format: "inet 192.168.1.100/24"
        if (trimmed.startsWith('inet ') && !trimmed.startsWith('inet6')) {
          const match = trimmed.match(/inet\s+([0-9.]+)\/?(\d+)?/);
          if (match) {
            currentIface.ipv4 = match[1];
            if (match[2]) {
              currentIface.netmask = `/${match[2]}`;
            }
          }
        }
        
        // IPv6 address - format: "inet6 fe80::1/64"
        if (trimmed.startsWith('inet6')) {
          const match = trimmed.match(/inet6\s+([a-f0-9:]+)/);
          if (match && !currentIface.ipv6) {
            currentIface.ipv6 = match[1];
          }
        }
      }
    }
    
    if (currentIface) {
      interfaces.push(currentIface);
    }
    
    // Get RX/TX statistics from /proc/net/dev
    try {
      const [stats] = this.utils.executeCommand('cat', ['/proc/net/dev']);
      const statLines = stats.split('\n');
      for (const iface of interfaces) {
        for (const statLine of statLines) {
          if (statLine.includes(iface.name + ':')) {
            const parts = statLine.split(/\s+/).filter(p => p);
            if (parts.length >= 10) {
              iface.rx = this.utils.formatBytes(parseInt(parts[1]));
              iface.tx = this.utils.formatBytes(parseInt(parts[9]));
            }
            break;
          }
        }
      }
    } catch (e) {
      console.error('Error reading network stats:', e);
    }
    
    return interfaces;
  }
  
  private getInterfaceIcon(name: string): string {
    if (name.startsWith('wl') || name.startsWith('wifi')) {
      return 'network-wireless-symbolic';
    } else if (name.startsWith('en') || name.startsWith('eth')) {
      return 'network-wired-symbolic';
    } else if (name.startsWith('lo')) {
      return 'network-server-symbolic';
    } else if (name.startsWith('docker') || name.startsWith('br')) {
      return 'network-workgroup-symbolic';
    }
    return 'network-wired-symbolic';
  }

  private formatUptime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days} days`);
    if (hours > 0) parts.push(`${hours} hours`);
    if (mins > 0) parts.push(`${mins} mins`);
    
    return parts.join(', ') || '0 mins';
  }

  public getWidget(): Gtk.Box {
    return this.container;
  }
}
