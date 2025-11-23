import Gtk from "@girs/gtk-4.0";
import GLib from "@girs/glib-2.0";
import { UtilsService } from "../services/utils-service";

interface LogEntry {
    timestamp: string;
    priority: string;
    message: string;
    service: string;
}

export class LogsComponent {
    private container: Gtk.Box;
    private notebook: Gtk.Notebook;
    private refreshButton: Gtk.Button;
    private utils: UtilsService;
    private updateTimeoutId: number | null = null;

    // System logs tab
    private systemLogsTextView!: Gtk.TextView;
    private systemLogsBuffer!: Gtk.TextBuffer;
    private systemLogFilterDropdown!: Gtk.DropDown;
    private systemPriorityDropdown!: Gtk.DropDown;
    private systemLinesSpinner!: Gtk.SpinButton;
    private systemStatusLabel!: Gtk.Label;
    private systemLogCountLabel!: Gtk.Label;
    private systemAuthenticateButton!: Gtk.Button;

    // User logs tab
    private userLogsTextView!: Gtk.TextView;
    private userLogsBuffer!: Gtk.TextBuffer;
    private userLogFilterDropdown!: Gtk.DropDown;
    private userPriorityDropdown!: Gtk.DropDown;
    private userLinesSpinner!: Gtk.SpinButton;
    private userStatusLabel!: Gtk.Label;
    private userLogCountLabel!: Gtk.Label;

    constructor() {
        this.utils = UtilsService.instance;

        const builder = Gtk.Builder.new();
        try {
            builder.add_from_file('/usr/share/com.obision.ObisionStatus/ui/logs.ui');
        } catch (e) {
            builder.add_from_file('data/ui/logs.ui');
        }

        this.container = builder.get_object('logs_container') as Gtk.Box;
        this.notebook = builder.get_object('notebook') as Gtk.Notebook;
        this.refreshButton = builder.get_object('refresh_button') as Gtk.Button;

        this.setupTabs();
        this.setupEventHandlers();
        this.loadSystemLogs();
        this.loadUserLogs();

        // Auto-refresh disabled by default
        this.updateTimeoutId = null;
    }

    private setupTabs(): void {
        // Create System Logs tab
        const systemTabContent = this.createTabContent(true);
        const systemTabLabel = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
        });
        systemTabLabel.append(new Gtk.Image({ icon_name: 'computer-symbolic' }));
        systemTabLabel.append(new Gtk.Label({ label: 'System Logs' }));
        this.notebook.append_page(systemTabContent, systemTabLabel);
        this.notebook.set_tab_reorderable(systemTabContent, false);
        this.notebook.set_tab_detachable(systemTabContent, false);

        // Create User Logs tab
        const userTabContent = this.createTabContent(false);
        const userTabLabel = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
        });
        userTabLabel.append(new Gtk.Image({ icon_name: 'user-available-symbolic' }));
        userTabLabel.append(new Gtk.Label({ label: 'User Logs' }));
        this.notebook.append_page(userTabContent, userTabLabel);
        this.notebook.set_tab_reorderable(userTabContent, false);
        this.notebook.set_tab_detachable(userTabContent, false);
    }

    private createTabContent(isSystemTab: boolean): Gtk.Box {
        const tabBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_start: 12,
            margin_end: 12,
            margin_top: 12,
            margin_bottom: 12,
        });

        // Filter controls
        const filterBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
        });

        filterBox.append(new Gtk.Label({ label: 'Filter:' }));

        const filterDropdown = new Gtk.DropDown();
        if (isSystemTab) {
            const filterModel = Gtk.StringList.new([
                'All Logs',
                'Kernel Logs',
                'Boot Logs',
                'System Services',
                'Authentication',
                'Cron Jobs',
                'Network Manager',
                'Bluetooth',
                'USB Events'
            ]);
            filterDropdown.set_model(filterModel);
            this.systemLogFilterDropdown = filterDropdown;
        } else {
            const filterModel = Gtk.StringList.new([
                'All User Logs',
                'User Services',
                'Desktop Session',
                'Applications',
                'Shell',
            ]);
            filterDropdown.set_model(filterModel);
            this.userLogFilterDropdown = filterDropdown;
        }
        filterDropdown.set_selected(0);
        filterBox.append(filterDropdown);

        filterBox.append(new Gtk.Label({ label: 'Priority:' }));

        const priorityDropdown = new Gtk.DropDown();
        const priorityModel = Gtk.StringList.new([
            'All Priorities',
            'Emergency',
            'Alert',
            'Critical',
            'Error',
            'Warning',
            'Notice',
            'Info',
            'Debug'
        ]);
        priorityDropdown.set_model(priorityModel);
        priorityDropdown.set_selected(0);
        filterBox.append(priorityDropdown);

        if (isSystemTab) {
            this.systemPriorityDropdown = priorityDropdown;
        } else {
            this.userPriorityDropdown = priorityDropdown;
        }

        filterBox.append(new Gtk.Label({ label: 'Lines:' }));

        const linesAdjustment = new Gtk.Adjustment({
            lower: 50,
            upper: 1000,
            step_increment: 50,
            page_increment: 100,
            value: 200,
        });
        const linesSpinner = new Gtk.SpinButton({
            adjustment: linesAdjustment,
        });
        filterBox.append(linesSpinner);

        if (isSystemTab) {
            this.systemLinesSpinner = linesSpinner;
            
            // Add authenticate button for system logs
            const authenticateButton = new Gtk.Button({
                label: 'Authenticate',
                tooltip_text: 'Authenticate to view all system logs',
            });
            filterBox.append(authenticateButton);
            this.systemAuthenticateButton = authenticateButton;
        } else {
            this.userLinesSpinner = linesSpinner;
        }

        tabBox.append(filterBox);

        // Logs display
        const scrolledWindow = new Gtk.ScrolledWindow({
            vexpand: true,
            hexpand: true,
        });

        const textView = new Gtk.TextView({
            editable: false,
            monospace: true,
            wrap_mode: Gtk.WrapMode.WORD_CHAR,
            margin_start: 12,
            margin_end: 12,
            margin_top: 12,
            margin_bottom: 12,
        });

        if (isSystemTab) {
            this.systemLogsTextView = textView;
            this.systemLogsBuffer = textView.get_buffer();
        } else {
            this.userLogsTextView = textView;
            this.userLogsBuffer = textView.get_buffer();
        }

        scrolledWindow.set_child(textView);
        tabBox.append(scrolledWindow);

        // Status bar
        const statusBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
        });

        const statusLabel = new Gtk.Label({
            label: 'Ready',
            halign: Gtk.Align.START,
            hexpand: true,
            css_classes: ['dim-label'],
        });
        statusBox.append(statusLabel);

        const logCountLabel = new Gtk.Label({
            label: '0 entries',
            halign: Gtk.Align.END,
            css_classes: ['dim-label'],
        });
        statusBox.append(logCountLabel);

        if (isSystemTab) {
            this.systemStatusLabel = statusLabel;
            this.systemLogCountLabel = logCountLabel;
        } else {
            this.userStatusLabel = statusLabel;
            this.userLogCountLabel = logCountLabel;
        }

        tabBox.append(statusBox);

        return tabBox;
    }

    private setupEventHandlers(): void {
        this.refreshButton.connect('clicked', () => {
            if (this.updateTimeoutId !== null) {
                // Disable auto-refresh
                GLib.source_remove(this.updateTimeoutId);
                this.updateTimeoutId = null;
                this.refreshButton.set_icon_name('media-playback-start-symbolic');
                this.refreshButton.set_tooltip_text('Enable Auto-refresh');
            } else {
                // Enable auto-refresh
                this.loadSystemLogs();
                this.loadUserLogs();
                this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, () => {
                    this.loadSystemLogs();
                    this.loadUserLogs();
                    return GLib.SOURCE_CONTINUE;
                });
                this.refreshButton.set_icon_name('media-playback-pause-symbolic');
                this.refreshButton.set_tooltip_text('Disable Auto-refresh');
            }
        });

        // System logs handlers
        this.systemLogFilterDropdown.connect('notify::selected', () => {
            this.loadSystemLogs();
        });

        this.systemPriorityDropdown.connect('notify::selected', () => {
            this.loadSystemLogs();
        });

        this.systemLinesSpinner.connect('value-changed', () => {
            this.loadSystemLogs();
        });

        this.systemAuthenticateButton.connect('clicked', () => {
            this.loadSystemLogsWithSudo();
        });

        // User logs handlers
        this.userLogFilterDropdown.connect('notify::selected', () => {
            this.loadUserLogs();
        });

        this.userPriorityDropdown.connect('notify::selected', () => {
            this.loadUserLogs();
        });

        this.userLinesSpinner.connect('value-changed', () => {
            this.loadUserLogs();
        });
    }

    private loadSystemLogsWithSudo(): void {
        this.systemStatusLabel.set_label('Authenticating...');
        
        const selectedFilter = this.systemLogFilterDropdown.get_selected();
        const selectedPriority = this.systemPriorityDropdown.get_selected();
        const numLines = this.systemLinesSpinner.get_value_as_int();

        try {
            let logs = '';
            // Show logs from the last 5 minutes to see fresh activity
            let args: string[] = ['journalctl', '--since', '5 minutes ago', '--no-pager', '-q'];

            // Add priority filter
            if (selectedPriority > 0) {
                const priorities = ['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug'];
                args.push('-p');
                args.push(priorities[selectedPriority - 1]);
            }

            // Add log source filter
            switch (selectedFilter) {
                case 0: // All Logs
                    break;
                case 1: // Kernel Logs
                    args.push('-k');
                    break;
                case 2: // Boot Logs
                    args.push('-b');
                    break;
                case 3: // System Services
                    args.push('-u', 'systemd');
                    break;
                case 4: // Authentication
                    args.push('-u', 'systemd-logind');
                    break;
                case 5: // Cron Jobs
                    args.push('-u', 'cron');
                    break;
                case 6: // Network Manager
                    args.push('-u', 'NetworkManager');
                    break;
                case 7: // Bluetooth
                    args.push('-u', 'bluetooth');
                    break;
                case 8: // USB Events
                    args.push('-k');
                    args.push('|');
                    args.push('grep');
                    args.push('-i');
                    args.push('usb');
                    break;
            }

            const [stdout, stderr] = this.utils.executeCommand('pkexec', args);
            
            if (stderr && stderr.includes('dismissed')) {
                logs = 'Authentication cancelled by user.';
                this.systemStatusLabel.set_label('Authentication cancelled');
            } else if (stderr && stderr.trim() !== '') {
                logs = `Error reading logs with elevated permissions:\n${stderr}\n\nOutput:\n${stdout || 'No output'}`;
                this.systemStatusLabel.set_label('Error');
            } else {
                logs = stdout || 'No logs found';
                this.systemStatusLabel.set_label('Logs loaded');
            }

            this.displayLogs(logs, true);
        } catch (error) {
            const errorMsg = `Error loading logs: ${error}`;
            this.displayLogs(errorMsg, true);
            this.systemStatusLabel.set_label('Error loading logs');
        }
    }

    private loadSystemLogs(): void {
        this.systemStatusLabel.set_label('Loading logs...');
        
        const selectedFilter = this.systemLogFilterDropdown.get_selected();
        const selectedPriority = this.systemPriorityDropdown.get_selected();
        const numLines = this.systemLinesSpinner.get_value_as_int();

        try {
            let logs = '';
            // Show logs from the last 5 minutes to see fresh activity
            let args: string[] = ['--since', '5 minutes ago', '--no-pager', '-q'];

            // Add priority filter
            if (selectedPriority > 0) {
                const priorities = ['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug'];
                args.push('-p');
                args.push(priorities[selectedPriority - 1]);
            }

            // Add log source filter
            switch (selectedFilter) {
                case 0: // All Logs
                    break;
                case 1: // Kernel Logs
                    args.push('-k');
                    break;
                case 2: // Boot Logs
                    args.push('-b');
                    break;
                case 3: // System Services
                    args.push('-u', 'systemd');
                    break;
                case 4: // Authentication
                    args.push('-u', 'systemd-logind');
                    break;
                case 5: // Cron Jobs
                    args.push('-u', 'cron');
                    break;
                case 6: // Network Manager
                    args.push('-u', 'NetworkManager');
                    break;
                case 7: // Bluetooth
                    args.push('-u', 'bluetooth');
                    break;
                case 8: // USB Events
                    args.push('-k');
                    args.push('|');
                    args.push('grep');
                    args.push('-i');
                    args.push('usb');
                    break;
            }

            const [stdout, stderr] = this.utils.executeCommand('journalctl', args);
            
            if (stderr && stderr.includes('insufficient permissions')) {
                logs = `System logs require elevated permissions.\n\n` +
                       `To view system logs, you can:\n` +
                       `1. Add your user to the 'systemd-journal' group:\n` +
                       `   sudo usermod -a -G systemd-journal $USER\n` +
                       `   (requires logout/login to take effect)\n\n` +
                       `2. Or run journalctl manually in terminal:\n` +
                       `   journalctl -n 200 --no-pager\n\n` +
                       `Showing accessible logs instead:\n\n${stdout || 'No accessible logs found'}`;
            } else if (stderr && stderr.trim() !== '') {
                logs = `Error reading logs:\n${stderr}\n\nOutput:\n${stdout || 'No output'}`;
            } else {
                logs = stdout || 'No logs found';
            }

            this.displayLogs(logs, true);
            const now = new Date();
            const timeStr = now.toLocaleTimeString();
            this.systemStatusLabel.set_label(`Logs loaded at ${timeStr}`);
        } catch (error) {
            const errorMsg = `Error loading logs: ${error}\n\nNote: journalctl may require additional permissions.`;
            this.displayLogs(errorMsg, true);
            this.systemStatusLabel.set_label('Error loading logs');
        }
    }

    private loadUserLogs(): void {
        this.userStatusLabel.set_label('Loading logs...');
        
        const selectedFilter = this.userLogFilterDropdown.get_selected();
        const selectedPriority = this.userPriorityDropdown.get_selected();
        const numLines = this.userLinesSpinner.get_value_as_int();

        try {
            let logs = '';
            // Show logs from the last 5 minutes to see fresh activity
            let args: string[] = ['--since', '5 minutes ago', '--no-pager', '--user', '-q'];

            // Add priority filter
            if (selectedPriority > 0) {
                const priorities = ['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug'];
                args.push('-p');
                args.push(priorities[selectedPriority - 1]);
            }

            // Add log source filter
            switch (selectedFilter) {
                case 0: // All User Logs
                    break;
                case 1: // User Services
                    // Already using --user flag
                    break;
                case 2: // Desktop Session
                    args.push('_SYSTEMD_USER_UNIT=gnome-session.target');
                    break;
                case 3: // Applications
                    args.push('_COMM=gjs');
                    break;
                case 4: // Shell
                    args.push('_COMM=gnome-shell');
                    break;
            }

            const [stdout, stderr] = this.utils.executeCommand('journalctl', args);
            
            if (stderr && stderr.trim() !== '') {
                logs = `Error reading logs:\n${stderr}`;
            } else {
                logs = stdout || 'No user logs found';
            }

            this.displayLogs(logs, false);
            const now = new Date();
            const timeStr = now.toLocaleTimeString();
            this.userStatusLabel.set_label(`Logs loaded at ${timeStr}`);
        } catch (error) {
            const errorMsg = `Error loading user logs: ${error}\n\nNote: User logs may not be available or require additional permissions.`;
            this.displayLogs(errorMsg, false);
            this.userStatusLabel.set_label('Error loading logs');
        }
    }

    private displayLogs(logs: string, isSystemTab: boolean): void {
        const buffer = isSystemTab ? this.systemLogsBuffer : this.userLogsBuffer;
        const textView = isSystemTab ? this.systemLogsTextView : this.userLogsTextView;
        const countLabel = isSystemTab ? this.systemLogCountLabel : this.userLogCountLabel;
        const statusLabel = isSystemTab ? this.systemStatusLabel : this.userStatusLabel;

        buffer.set_text(logs, -1);
        
        const lineCount = logs.split('\n').length;
        countLabel.set_label(`${lineCount} entries`);

        // Apply syntax highlighting
        this.applySyntaxHighlighting(buffer);

        // Scroll to the last line after UI is rendered
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            const endIter = buffer.get_end_iter();
            const mark = buffer.create_mark(null, endIter, false);
            textView.scroll_to_mark(mark, 0.0, true, 0.0, 1.0);
            buffer.delete_mark(mark);
            return GLib.SOURCE_REMOVE;
        });
    }

    private applySyntaxHighlighting(buffer: Gtk.TextBuffer): void {
        const tagTable = buffer.get_tag_table();
        
        // Get or create tags for different log levels
        let errorTag = tagTable.lookup('error');
        if (!errorTag) {
            errorTag = new Gtk.TextTag({
                name: 'error',
                foreground: '#ff6b6b',
                weight: 700,
            });
            tagTable.add(errorTag);
        }

        let warningTag = tagTable.lookup('warning');
        if (!warningTag) {
            warningTag = new Gtk.TextTag({
                name: 'warning',
                foreground: '#ffa500',
                weight: 600,
            });
            tagTable.add(warningTag);
        }

        let infoTag = tagTable.lookup('info');
        if (!infoTag) {
            infoTag = new Gtk.TextTag({
                name: 'info',
                foreground: '#4a9eff',
            });
            tagTable.add(infoTag);
        }

        let successTag = tagTable.lookup('success');
        if (!successTag) {
            successTag = new Gtk.TextTag({
                name: 'success',
                foreground: '#51cf66',
            });
            tagTable.add(successTag);
        }

        let timestampTag = tagTable.lookup('timestamp');
        if (!timestampTag) {
            timestampTag = new Gtk.TextTag({
                name: 'timestamp',
                foreground: '#868e96',
            });
            tagTable.add(timestampTag);
        }

        // Apply tags to text
        const startIter = buffer.get_start_iter();
        const endIter = buffer.get_end_iter();
        const text = buffer.get_text(startIter, endIter, false);
        const lines = text.split('\n');

        let currentPos = 0;
        for (const line of lines) {
            const lineStart = buffer.get_iter_at_offset(currentPos);
            const lineEnd = buffer.get_iter_at_offset(currentPos + line.length);

            // Highlight timestamps
            const timestampMatch = line.match(/^[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}/);
            if (timestampMatch) {
                const tsEnd = buffer.get_iter_at_offset(currentPos + timestampMatch[0].length);
                buffer.apply_tag(timestampTag, lineStart, tsEnd);
            }

            // Highlight error levels
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes('error') || lowerLine.includes('fail') || lowerLine.includes('critical')) {
                buffer.apply_tag(errorTag, lineStart, lineEnd);
            } else if (lowerLine.includes('warn')) {
                buffer.apply_tag(warningTag, lineStart, lineEnd);
            } else if (lowerLine.includes('success') || lowerLine.includes('started')) {
                buffer.apply_tag(successTag, lineStart, lineEnd);
            } else if (lowerLine.includes('info')) {
                buffer.apply_tag(infoTag, lineStart, lineEnd);
            }

            currentPos += line.length + 1; // +1 for newline
        }
    }

    public getWidget(): Gtk.Box {
        return this.container;
    }

    public destroy(): void {
        if (this.updateTimeoutId !== null) {
            GLib.source_remove(this.updateTimeoutId);
        }
    }
}
