# 🚜 AGROtrack - Gestión Agrícola (v1.2)

Aplicación web progresiva (PWA) para la gestión integral de explotaciones agrícolas de viña y olivar.

## ✨ Nuevas características (v1.2)

- 🔍 **Buscador en Fincas:** Filtra por nombre, municipio, polígono o parcela
- 📊 **Ordenamiento:** Ordena fincas por nombre, superficie, cultivo o año
- 🃏 **Tarjetas modernas:** Interfaz visual con iconos y badges de color
- 📱 **Navegación mejorada:** 8 accesos directos en la barra inferior
- 🎨 **Diseño responsive:** Optimizado para iPhone, iPad y escritorio

## 🚀 Quick Start (Local)

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
Crea un archivo `.env` en la raíz del proyecto:
```
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_clave_anon
```

### 3. Ejecutar en modo desarrollo
```bash
npm run dev
```

## 🌐 Despliegue (accesible desde cualquier dispositivo)

Ver `docs/06_guia_despliegue.md` para:
- Subir a GitHub
- Desplegar en Vercel (gratis)
- Instalar como app en iPhone
- Acceder desde Windows

## 📁 Estructura del proyecto

```
AGROtrack/
├── index.html
├── package.json
├── vite.config.js
├── manifest.json
├── .env
├── .gitignore
├── src/
│   ├── main.jsx              # Punto de entrada
│   ├── App.jsx               # Componente principal
│   ├── data/
│   │   └── supabaseClient.js # Cliente de Supabase
│   ├── components/
│   │   ├── Sidebar.jsx            # Menú lateral (escritorio)
│   │   ├── MobileHeader.jsx       # Cabecera móvil
│   │   ├── BottomNav.jsx          # Navegación inferior (móvil)
│   │   ├── Dashboard.jsx          # Panel principal con gráficos
│   │   ├── LaboresPage.jsx        # Registro de labores
│   │   ├── AplicacionesPage.jsx   # Aplicaciones fitosanitarias
│   │   ├── CosechasPage.jsx       # Registro de cosechas
│   │   ├── GastosPage.jsx         # Registro de gastos
│   │   ├── FinanzasPage.jsx       # Panel de finanzas
│   │   ├── FincasPage.jsx         # Gestión de fincas
│   │   ├── PersonalPage.jsx       # Gestión de personal
│   │   ├── MaquinariaPage.jsx     # Gestión de maquinaria
│   │   ├── InventarioPage.jsx     # Gestión de inventario
│   │   └── ConfiguracionPage.jsx  # Configuración y ayuda
│   └── styles/
│       └── global.css             # Estilos globales
```

## 🗄️ Base de datos

La aplicación utiliza Supabase como base de datos. Las tablas necesarias son:

- `fincas` - Información de las fincas
- `personal` - Operarios y su información
- `maquinaria` - Equipos y maquinaria
- `labores` - Registro de trabajos diarios
- `aplicaciones` - Aplicaciones fitosanitarias
- `cosechas` - Registro de cosechas
- `gastos_manual` - Gastos manuales
- `inventario` - Artículos y stock
- `params` - Parámetros de configuración

## 📱 Instalación en iPhone (PWA)

1. Abre la app en Safari
2. Toca el botón Compartir (⬆️)
3. Selecciona "Añadir a la pantalla de inicio"
4. Confirma con "Añadir"

## 🛠️ Tecnologías

- **React 18** - Librería de interfaz
- **Vite** - Build tool
- **Supabase** - Base de datos + autenticación
- **Recharts** - Gráficos y visualizaciones
- **date-fns** - Manipulación de fechas
- **Lucide React** - Iconos

## 📄 Licencia

Este proyecto es de uso personal para la gestión de la explotación agrícola AGROtrack.
