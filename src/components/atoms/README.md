# Top Processes List - Atom Component

## Descripción
Componente reutilizable que muestra un listado de procesos ordenados por uso de CPU o memoria.

## Ubicación
`src/components/atoms/top-processes-list.ts`

## Uso

### Importar el componente
```typescript
import { TopProcessesList, ProcessInfo, SortBy } from './atoms/top-processes-list';
```

### Crear instancia
```typescript
// Ordenar por CPU, mostrar 5 procesos
const topProcesses = new TopProcessesList('cpu', 5);

// Ordenar por memoria, mostrar 10 procesos
const topProcesses = new TopProcessesList('memory', 10);
```

### Añadir al contenedor
```typescript
const mainBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
mainBox.append(topProcesses.getWidget());
```

### Actualizar datos
```typescript
const processes: ProcessInfo[] = [
  { name: 'firefox', cpu: 45.2, memory: 512000 },
  { name: 'chrome', cpu: 32.1, memory: 890000 },
  { name: 'code', cpu: 12.5, memory: 450000 },
];

topProcesses.updateProcesses(processes);
```

### Cambiar configuración
```typescript
// Cambiar criterio de ordenación
topProcesses.setSortBy('memory');

// Cambiar número máximo de líneas
topProcesses.setMaxLines(8);
```

## Parámetros del Constructor

- **sortBy** (`'cpu' | 'memory'`): Criterio de ordenación
  - `'cpu'`: Ordena por uso de CPU (%)
  - `'memory'`: Ordena por uso de memoria (KB)
  
- **maxLines** (`number`): Número máximo de procesos a mostrar (default: 5)

## Métodos Públicos

- `getWidget(): Gtk.Box` - Retorna el widget contenedor
- `updateProcesses(processes: ProcessInfo[])` - Actualiza la lista de procesos
- `setSortBy(sortBy: SortBy)` - Cambia el criterio de ordenación
- `setMaxLines(maxLines: number)` - Cambia el número máximo de líneas
- `destroy()` - Limpia recursos

## Interfaz ProcessInfo

```typescript
interface ProcessInfo {
  name: string;    // Nombre del proceso
  cpu: number;     // Uso de CPU en porcentaje
  memory: number;  // Uso de memoria en KB
}
```

## Ejemplo de Integración en un Componente

```typescript
import Gtk from '@girs/gtk-4.0';
import GLib from '@girs/glib-2.0';
import { TopProcessesList, ProcessInfo } from './atoms/top-processes-list';
import { ProcessesService } from '../services/processes-service';

export class CpuComponent {
  private topProcessesList: TopProcessesList;
  private processesService: ProcessesService;
  
  constructor() {
    // Crear widget de top processes ordenado por CPU
    this.topProcessesList = new TopProcessesList('cpu', 8);
    this.processesService = ProcessesService.instance;
    
    // Añadir al layout
    const rightPanel = builder.get_object('right_panel') as Gtk.Box;
    rightPanel.append(this.topProcessesList.getWidget());
    
    // Actualizar periódicamente
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
      this.updateTopProcesses();
      return GLib.SOURCE_CONTINUE;
    });
  }
  
  private updateTopProcesses(): void {
    const allProcesses = this.processesService.getProcesses();
    this.topProcessesList.updateProcesses(allProcesses);
  }
  
  public destroy(): void {
    this.topProcessesList.destroy();
  }
}
```

## Build Script

El componente debe incluirse en `scripts/build.js` en la sección de atoms, antes de los componentes principales:

```javascript
// Add TopProcessesList atom component
const topProcessesListFile = path.join(BUILD_DIR, 'components', 'atoms', 'top-processes-list.js');
if (fs.existsSync(topProcessesListFile)) {
    console.log('📋 Adding TopProcessesList atom...');
    // ... cleanup and concatenation
}
```
