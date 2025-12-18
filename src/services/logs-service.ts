import GLib from "@girs/glib-2.0";
import { UtilsService } from "./utils-service";
import { LogsData } from "../interfaces/logs";

export class LogsService {
    private static _instance: LogsService;
    private utils: UtilsService;
    private updateTimeoutId: number | null = null;
    private dataCallbacks: Array<(data: LogsData) => void> = [];
    private isAutoRefreshEnabled: boolean = false;

    private systemLogFilter: number = 0;
    private systemPriority: number = 0;
    private systemLines: number = 200;

    private userLogFilter: number = 0;
    private userPriority: number = 0;
    private userLines: number = 200;
    private systemLogsAuthenticated: boolean = false;

    private constructor() {
        this.utils = UtilsService.instance;
    }

    public static get instance(): LogsService {
        if (!LogsService._instance) {
            LogsService._instance = new LogsService();
        }
        return LogsService._instance;
    }

    public subscribeToUpdates(callback: (data: LogsData) => void): void {
        this.dataCallbacks.push(callback);
        this.updateData();
    }

    public unsubscribe(callback: (data: LogsData) => void): void {
        const index = this.dataCallbacks.indexOf(callback);
        if (index > -1) {
            this.dataCallbacks.splice(index, 1);
        }
        
        if (this.dataCallbacks.length === 0) {
            this.stopAutoRefresh();
        }
    }

    public setSystemLogFilter(filter: number, priority: number, lines: number): void {
        this.systemLogFilter = filter;
        this.systemPriority = priority;
        this.systemLines = lines;
        this.updateData();
    }

    public setUserLogFilter(filter: number, priority: number, lines: number): void {
        this.userLogFilter = filter;
        this.userPriority = priority;
        this.userLines = lines;
        this.updateData();
    }

    public toggleAutoRefresh(): boolean {
        this.isAutoRefreshEnabled = !this.isAutoRefreshEnabled;
        
        if (this.isAutoRefreshEnabled) {
            this.startAutoRefresh();
        } else {
            this.stopAutoRefresh();
        }
        
        return this.isAutoRefreshEnabled;
    }

    public loadSystemLogsWithSudo(): { success: boolean; data: string; error?: string } {
        const result = this.loadSystemLogsInternal(true);
        return { success: true, data: result };
    }
    
    public setSystemLogsAuthenticated(authenticated: boolean): void {
        this.systemLogsAuthenticated = authenticated;
    }
    
    public isSystemLogsAuthenticated(): boolean {
        return this.systemLogsAuthenticated;
    }

    public requestSystemLogsWithElevation(): void {
        // Try to load with sudo, but only update if successful
        const result = this.loadSystemLogsInternal(true);
        if (result && !result.includes('cancelled by user') && !result.includes('dismissed')) {
            // Update all callbacks with elevated logs
            const data: LogsData = {
                systemLogs: result,
                userLogs: this.loadUserLogs(),
            };
            this.dataCallbacks.forEach(callback => callback(data));
        }
        // If cancelled or failed, keep showing the normal logs (already loaded)
    }

    private startAutoRefresh(): void {
        if (this.updateTimeoutId !== null) {
            return;
        }

        this.updateData();
        this.updateTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, () => {
            this.updateData();
            return GLib.SOURCE_CONTINUE;
        });
    }

    private stopAutoRefresh(): void {
        if (this.updateTimeoutId !== null) {
            GLib.source_remove(this.updateTimeoutId);
            this.updateTimeoutId = null;
        }
    }

    public requestUpdate(): void {
        this.updateData();
    }

    private updateData(): void {
        const data: LogsData = {
            systemLogs: this.systemLogsAuthenticated ? this.loadSystemLogsInternal(true) : '',
            userLogs: this.loadUserLogs(),
        };

        this.dataCallbacks.forEach(callback => callback(data));
    }

    private loadSystemLogsInternal(useSudo: boolean): string {
        try {
            let args: string[] = ['--no-pager', '-n', this.systemLines.toString(), '-o', 'short'];

            if (this.systemPriority > 0) {
                const priorities = ['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug'];
                args.push('-p');
                args.push(priorities[this.systemPriority - 1]);
            }

            switch (this.systemLogFilter) {
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
                    break;
            }

            const command = useSudo ? 'pkexec' : 'journalctl';
            const finalArgs = useSudo ? ['journalctl', ...args] : args;
            const [stdout, stderr] = this.utils.executeCommand(command, finalArgs);

            if (useSudo && stderr && (stderr.includes('dismissed') || stderr.includes('Error executing command'))) {
                return 'AUTH_CANCELLED';
            } else if (stderr && stderr.includes('insufficient permissions')) {
                return `System logs require elevated permissions.\n\n` +
                       `To view system logs, you can:\n` +
                       `1. Add your user to the 'systemd-journal' group:\n` +
                       `   sudo usermod -a -G systemd-journal $USER\n` +
                       `   (requires logout/login to take effect)\n\n` +
                       `2. Or run journalctl manually in terminal:\n` +
                       `   journalctl -n 200 --no-pager\n\n` +
                       `Showing accessible logs instead:\n\n${stdout || 'No accessible logs found'}`;
            }

            // Return logs directly without hints
            return stdout && stdout.trim() ? stdout : 'No logs found';
        } catch (error) {
            return `Error loading logs: ${error}\n\nNote: journalctl may require additional permissions.`;
        }
    }

    private loadUserLogs(): string {
        try {
            let args: string[] = ['--no-pager', '--user', '-n', this.userLines.toString(), '-o', 'short'];

            if (this.userPriority > 0) {
                const priorities = ['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug'];
                args.push('-p');
                args.push(priorities[this.userPriority - 1]);
            }

            switch (this.userLogFilter) {
                case 0: // All User Logs
                    break;
                case 1: // User Services
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

            // Return logs directly without hints
            return stdout && stdout.trim() ? stdout : 'No user logs found';
        } catch (error) {
            return `Error loading user logs: ${error}\n\nNote: User logs may not be available or require additional permissions.`;
        }
    }
}
