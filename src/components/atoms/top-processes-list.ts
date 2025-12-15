import Gtk from '@girs/gtk-4.0';
import { UtilsService } from '../../services/utils-service';

export interface ProcessInfo {
  name: string;
  cpu: number;
  memory: number;
}

export type SortBy = 'cpu' | 'memory';

export class TopProcessesList {
  private container: Gtk.Box;
  private listBox: Gtk.ListBox;
  private sortBy: SortBy;
  private maxLines: number;
  private utils: UtilsService;

  constructor(sortBy: SortBy = 'cpu', maxLines: number = 5) {
    this.sortBy = sortBy;
    this.maxLines = maxLines;
    this.utils = UtilsService.instance;
    
    // Create container
    this.container = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 0,
      margin_top: 6,
      margin_start: 6,
      margin_end: 6,
    });
    
    // Create list box
    this.listBox = new Gtk.ListBox({
      selection_mode: Gtk.SelectionMode.NONE,
    });
    this.listBox.add_css_class('boxed-list');
    
    this.container.append(this.listBox);
  }
  
  private getTitleText(): string {
    switch (this.sortBy) {
      case 'cpu':
        return 'Top CPU Processes';
      case 'memory':
        return 'Top Memory Processes';
      default:
        return 'Top Processes';
    }
  }
  
  public getWidget(): Gtk.Box {
    return this.container;
  }
  
  public setSortBy(sortBy: SortBy): void {
    this.sortBy = sortBy;
  }
  
  public setMaxLines(maxLines: number): void {
    this.maxLines = maxLines;
  }
  
  public updateProcesses(processes: ProcessInfo[]): void {
    // Clear current list
    let child = this.listBox.get_first_child();
    while (child) {
      const next = child.get_next_sibling();
      this.listBox.remove(child);
      child = next;
    }
    
    // Sort processes based on sortBy
    const sortedProcesses = [...processes].sort((a, b) => {
      if (this.sortBy === 'cpu') {
        return b.cpu - a.cpu;
      } else {
        return b.memory - a.memory;
      }
    });
    
    // Take only maxLines processes
    const topProcesses = sortedProcesses.slice(0, this.maxLines);
    
    // Add processes to list
    for (const process of topProcesses) {
      const row = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 8,
        margin_start: 8,
        margin_end: 8,
        margin_top: 4,
        margin_bottom: 4,
      });
      
      const nameLabel = new Gtk.Label({
        label: process.name,
        halign: Gtk.Align.START,
        hexpand: true,
        ellipsize: 3, // PANGO_ELLIPSIZE_END
        max_width_chars: 20,
      });
      
      const valueLabel = new Gtk.Label({
        label: this.sortBy === 'cpu' 
          ? `${process.cpu.toFixed(1)}%`
          : this.utils.formatBytes(process.memory * 1024), // Convert KB to bytes
        halign: Gtk.Align.END,
      });
      
      row.append(nameLabel);
      row.append(valueLabel);
      this.listBox.append(row);
    }
  }
  
  public destroy(): void {
    // Cleanup if needed
  }
}
