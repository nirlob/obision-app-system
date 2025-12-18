import Gio from '@girs/gio-2.0';

export class UtilsService {
  static _instance: UtilsService;

  public static get instance(): UtilsService {
    if (!UtilsService._instance) {
      UtilsService._instance = new UtilsService();
    }

    return UtilsService._instance;
  }

  public executeCommand(command: string, args: string[] = []): [string, string] {
    try {
      const process = new Gio.Subprocess({
        argv: [command, ...args],
        flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
      });

      process.init(null);

      const [ok, stdout, stderr] = process.communicate_utf8(null, null);
      if (ok) {
        return [stdout, stderr];
      } else {
        throw new Error('Failed to execute command');
      }
    } catch (error) {
      throw error;
    }
  }

  public formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  public capitalizeWords(str: string): string {
    return str.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }

  /**
   * Authenticate as root using pkexec.
   * @returns true if authentication succeeded, false if cancelled or failed
   */
  public authenticateAsRoot(): boolean {
    try {
      const [stdout, stderr] = this.executeCommand('pkexec', ['true']);
      
      // Check if authentication was cancelled or dismissed
      if (stderr && (stderr.includes('dismissed') || stderr.includes('Error executing command'))) {
        return false;
      }
      
      // If no errors, authentication succeeded
      return true;
    } catch (error) {
      return false;
    }
  }
}
