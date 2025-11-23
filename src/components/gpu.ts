import Gtk from '@girs/gtk-4.0';
import GLib from '@girs/glib-2.0';
import { UtilsService } from '../services/utils-service';

export class GpuComponent {
  private container: Gtk.Box;
  private gpuChart!: Gtk.DrawingArea;
  private gpuNameValue!: Gtk.Label;
  private gpuDriverValue!: Gtk.Label;
  private gpuMemoryTotalValue!: Gtk.Label;
  private gpuMemoryUsedValue!: Gtk.Label;
  private gpuUsageValue!: Gtk.Label;
  private gpuTemperatureValue!: Gtk.Label;
  private gpuPowerValue!: Gtk.Label;
  private updateTimeoutId: number | null = null;
  private utils: UtilsService;
  private usageHistory: number[] = [];
  private readonly maxHistoryPoints = 60;
  private hasNvidiaGpu: boolean = false;

  constructor() {
    this.utils = UtilsService.instance;
    const builder = Gtk.Builder.new();
    
    try {
      try {
        builder.add_from_file('/usr/share/com.obision.ObisionStatus/ui/gpu.ui');
      } catch (e) {
        builder.add_from_file('data/ui/gpu.ui');
      }
    } catch (e) {
      console.error('Could not load gpu.ui:', e);
      this.container = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 12,
      });
      return;
    }

    this.container = builder.get_object('gpu_container') as Gtk.Box;
    this.gpuChart = builder.get_object('gpu_chart') as Gtk.DrawingArea;
    this.gpuNameValue = builder.get_object('gpu_name_value') as Gtk.Label;
    this.gpuDriverValue = builder.get_object('gpu_driver_value') as Gtk.Label;
    this.gpuMemoryTotalValue = builder.get_object('gpu_memory_total_value') as Gtk.Label;
    this.gpuMemoryUsedValue = builder.get_object('gpu_memory_used_value') as Gtk.Label;
    this.gpuUsageValue = builder.get_object('gpu_usage_value') as Gtk.Label;
    this.gpuTemperatureValue = builder.get_object('gpu_temperature_value') as Gtk.Label;
    this.gpuPowerValue = builder.get_object('gpu_power_value') as Gtk.Label;
    
    // Initialize history with zeros
    for (let i = 0; i < this.maxHistoryPoints; i++) {
      this.usageHistory.push(0);
    }
    
    // Setup drawing function for chart
    this.gpuChart.set_draw_func((area, cr, width, height) => {
      this.drawLineChart(cr, width, height);
    });
    
    // Check for NVIDIA GPU
    this.checkNvidiaGpu();
    
    // Load static GPU info
    this.loadGpuInfo();
    
    // Initial update
    this.updateData();
    
    // Update every 2 seconds
    this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
      this.updateData();
      return GLib.SOURCE_CONTINUE;
    });
  }

  private checkNvidiaGpu(): void {
    try {
      const [stdout] = this.utils.executeCommand('which', ['nvidia-smi']);
      this.hasNvidiaGpu = stdout.trim().length > 0;
    } catch (e) {
      this.hasNvidiaGpu = false;
    }
  }

  private loadGpuInfo(): void {
    try {
      if (this.hasNvidiaGpu) {
        // Get GPU name
        const [nameOut] = this.utils.executeCommand('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader']);
        if (nameOut.trim()) {
          this.gpuNameValue.set_label(nameOut.trim());
        }
        
        // Get driver version
        const [driverOut] = this.utils.executeCommand('nvidia-smi', ['--query-gpu=driver_version', '--format=csv,noheader']);
        if (driverOut.trim()) {
          this.gpuDriverValue.set_label(driverOut.trim());
        }
        
        // Get total memory
        const [memoryOut] = this.utils.executeCommand('nvidia-smi', ['--query-gpu=memory.total', '--format=csv,noheader']);
        if (memoryOut.trim()) {
          this.gpuMemoryTotalValue.set_label(memoryOut.trim());
        }
      } else {
        // Try lspci for GPU info
        const [lspciOut] = this.utils.executeCommand('lspci', []);
        const gpuLine = lspciOut.split('\n').find(line => 
          line.toLowerCase().includes('vga') || 
          line.toLowerCase().includes('3d') ||
          line.toLowerCase().includes('display')
        );
        
        if (gpuLine) {
          const gpuName = gpuLine.split(':').slice(2).join(':').trim();
          this.gpuNameValue.set_label(gpuName);
        }
        
        this.gpuDriverValue.set_label('N/A (nvidia-smi not available)');
        this.gpuMemoryTotalValue.set_label('N/A');
      }
    } catch (error) {
      console.error('Error loading GPU info:', error);
      this.gpuNameValue.set_label('Unable to detect GPU');
    }
  }

  private updateData(): void {
    try {
      if (this.hasNvidiaGpu) {
        // Get GPU utilization
        const [utilizationOut] = this.utils.executeCommand('nvidia-smi', 
          ['--query-gpu=utilization.gpu', '--format=csv,noheader,nounits']);
        const utilization = parseFloat(utilizationOut.trim());
        
        if (!isNaN(utilization)) {
          this.gpuUsageValue.set_label(`${utilization.toFixed(1)}%`);
          
          // Update history
          this.usageHistory.push(utilization);
          if (this.usageHistory.length > this.maxHistoryPoints) {
            this.usageHistory.shift();
          }
        }
        
        // Get memory used
        const [memoryUsedOut] = this.utils.executeCommand('nvidia-smi', 
          ['--query-gpu=memory.used', '--format=csv,noheader']);
        if (memoryUsedOut.trim()) {
          this.gpuMemoryUsedValue.set_label(memoryUsedOut.trim());
        }
        
        // Get temperature
        const [tempOut] = this.utils.executeCommand('nvidia-smi', 
          ['--query-gpu=temperature.gpu', '--format=csv,noheader,nounits']);
        if (tempOut.trim()) {
          this.gpuTemperatureValue.set_label(`${tempOut.trim()}°C`);
        }
        
        // Get power usage
        const [powerOut] = this.utils.executeCommand('nvidia-smi', 
          ['--query-gpu=power.draw', '--format=csv,noheader']);
        if (powerOut.trim()) {
          this.gpuPowerValue.set_label(powerOut.trim());
        }
      } else {
        this.gpuUsageValue.set_label('N/A');
        this.gpuMemoryUsedValue.set_label('N/A');
        this.gpuTemperatureValue.set_label('N/A');
        this.gpuPowerValue.set_label('N/A');
        
        // Keep updating history with 0 for chart continuity
        this.usageHistory.push(0);
        if (this.usageHistory.length > this.maxHistoryPoints) {
          this.usageHistory.shift();
        }
      }
      
      // Redraw chart
      this.gpuChart.queue_draw();
    } catch (error) {
      console.error('Error updating GPU data:', error);
    }
  }

  private drawLineChart(cr: any, width: number, height: number): void {
    const padding = 20;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;
    
    // Clear background
    cr.setSourceRGB(1, 1, 1);
    cr.paint();
    
    // Draw grid lines
    cr.setSourceRGBA(0.8, 0.8, 0.8, 0.5);
    cr.setLineWidth(1);
    
    // Horizontal grid lines (0%, 25%, 50%, 75%, 100%)
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight * i / 4);
      cr.moveTo(padding, y);
      cr.lineTo(width - padding, y);
      cr.stroke();
    }
    
    // Draw axes
    cr.setSourceRGB(0.5, 0.5, 0.5);
    cr.setLineWidth(2);
    cr.moveTo(padding, padding);
    cr.lineTo(padding, height - padding);
    cr.lineTo(width - padding, height - padding);
    cr.stroke();
    
    // Draw data line
    if (this.usageHistory.length > 1) {
      cr.setSourceRGB(0.1, 0.8, 0.3);
      cr.setLineWidth(2);
      
      const pointSpacing = chartWidth / (this.maxHistoryPoints - 1);
      
      cr.moveTo(padding, height - padding - (this.usageHistory[0] / 100) * chartHeight);
      
      for (let i = 1; i < this.usageHistory.length; i++) {
        const x = padding + i * pointSpacing;
        const y = height - padding - (this.usageHistory[i] / 100) * chartHeight;
        cr.lineTo(x, y);
      }
      
      cr.stroke();
      
      // Fill area under the line
      cr.setSourceRGBA(0.1, 0.8, 0.3, 0.2);
      cr.lineTo(width - padding, height - padding);
      cr.lineTo(padding, height - padding);
      cr.closePath();
      cr.fill();
    }
    
    // Draw labels
    cr.setSourceRGB(0.3, 0.3, 0.3);
    cr.selectFontFace('Sans', 0, 0);
    cr.setFontSize(10);
    
    // Y-axis labels
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight * i / 4);
      const label = `${100 - (i * 25)}%`;
      cr.moveTo(5, y + 3);
      cr.showText(label);
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
