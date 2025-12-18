import Gtk from "@girs/gtk-4.0";
import { UtilsService } from "../services/utils-service";
import { LogsService } from "../services/logs-service";
import { LogsData } from "../interfaces/logs";

export class UserLogsComponent {
    private container: Gtk.Box;
    private utils: UtilsService;
    private logsService: LogsService;
    private dataCallback!: (data: LogsData) => void;

    private logsTextView!: Gtk.TextView;
    private logsBuffer!: Gtk.TextBuffer;
    private logFilterDropdown!: Gtk.DropDown;
    private priorityDropdown!: Gtk.DropDown;
    private linesSpinner!: Gtk.SpinButton;
    private filterBox!: Gtk.Box;

    constructor() {
        this.utils = UtilsService.instance;
        this.logsService = LogsService.instance;

        this.container = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0,
        });

        this.setupUI();
        this.setupEventHandlers();
        
        // Subscribe to logs service
        this.dataCallback = this.onDataUpdate.bind(this);
        this.logsService.subscribeToUpdates(this.dataCallback);
    }

    private setupUI(): void {
        // Filter controls
        this.filterBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            margin_start: 12,
            margin_end: 12,
            margin_top: 12,
            margin_bottom: 12,
        });

        this.filterBox.append(new Gtk.Label({ label: 'Filter:' }));

        this.logFilterDropdown = new Gtk.DropDown();
        const filterModel = Gtk.StringList.new([
            'All Logs', 'User Services', 'Desktop Session', 'Applications', 'Shell'
        ]);
        this.logFilterDropdown.set_model(filterModel);
        this.logFilterDropdown.set_selected(0);
        this.filterBox.append(this.logFilterDropdown);

        this.filterBox.append(new Gtk.Label({ label: 'Priority:' }));

        this.priorityDropdown = new Gtk.DropDown();
        const priorityModel = Gtk.StringList.new([
            'All Priorities', 'Emergency', 'Alert', 'Critical',
            'Error', 'Warning', 'Notice', 'Info', 'Debug'
        ]);
        this.priorityDropdown.set_model(priorityModel);
        this.priorityDropdown.set_selected(0);
        this.filterBox.append(this.priorityDropdown);

        this.filterBox.append(new Gtk.Label({ label: 'Lines:' }));

        const linesAdjustment = new Gtk.Adjustment({
            lower: 50, upper: 1000, step_increment: 50,
            page_increment: 100, value: 200,
        });
        this.linesSpinner = new Gtk.SpinButton({ adjustment: linesAdjustment });
        this.filterBox.append(this.linesSpinner);

        this.container.append(this.filterBox);

        // Logs display
        const scrolledWindow = new Gtk.ScrolledWindow({
            vexpand: true,
            hexpand: true,
        });

        this.logsTextView = new Gtk.TextView({
            editable: false,
            monospace: true,
            wrap_mode: Gtk.WrapMode.WORD_CHAR,
            margin_start: 12,
            margin_end: 12,
            margin_top: 12,
            margin_bottom: 12,
        });
        this.logsBuffer = this.logsTextView.get_buffer();

        scrolledWindow.set_child(this.logsTextView);
        this.container.append(scrolledWindow);
    }

    private onDataUpdate(data: LogsData): void {
        this.logsBuffer.set_text(data.userLogs, -1);
    }

    private setupEventHandlers(): void {
        // Filter change handlers
        this.logFilterDropdown.connect('notify::selected', () => {
            this.updateLogsWithFilters();
        });

        this.priorityDropdown.connect('notify::selected', () => {
            this.updateLogsWithFilters();
        });

        this.linesSpinner.connect('value-changed', () => {
            this.updateLogsWithFilters();
        });
    }

    private updateLogsWithFilters(): void {
        const selectedFilter = this.logFilterDropdown.get_selected();
        const selectedPriority = this.priorityDropdown.get_selected();
        const numLines = this.linesSpinner.get_value_as_int();
        
        this.logsService.setUserLogFilter(selectedFilter, selectedPriority, numLines);
    }

    public getWidget(): Gtk.Box {
        return this.container;
    }

    public destroy(): void {
        this.logsService.unsubscribe(this.dataCallback);
    }
}

