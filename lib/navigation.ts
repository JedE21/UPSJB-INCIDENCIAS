import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  ClipboardList,
  Cpu,
  Home,
  Info,
  LayoutDashboard,
  Palette,
  LogIn,
  QrCode,
  ScrollText,
  Search,
  Settings,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AppContext = "public" | "usuario" | "tecnico" | "coordinador" | "admin";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Coincidencia exacta (para la raíz de cada panel). */
  exact?: boolean;
}

/** Navegación pública (§53 del Plan Maestro). */
export const publicNav: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home, exact: true },
  { href: "/reportar", label: "Reportar incidencia", icon: QrCode },
  { href: "/seguimiento", label: "Consultar incidencia", icon: Search },
  { href: "/informacion", label: "Información", icon: Info },
];

/** Navegación por contexto autenticado (estructura Fase 1; la protección de rutas llega en la Fase 3). */
export const contextNav: Record<
  Exclude<AppContext, "public">,
  NavItem[]
> = {
  usuario: [
    { href: "/mis-incidencias", label: "Mis incidencias", icon: ClipboardList },
    { href: "/notificaciones", label: "Notificaciones", icon: Bell },
    { href: "/perfil", label: "Perfil", icon: User },
  ],
  tecnico: [
    { href: "/tecnico/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/tecnico/incidencias", label: "Mis incidencias", icon: ClipboardList },
    { href: "/tecnico/perfil", label: "Perfil", icon: User },
  ],
  coordinador: [
    { href: "/coordinador/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/coordinador/incidencias", label: "Incidencias", icon: ClipboardList },
  ],
  admin: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/admin/incidencias", label: "Incidencias", icon: ClipboardList },
    { href: "/admin/usuarios", label: "Usuarios", icon: Users },
    { href: "/admin/infraestructura", label: "Infraestructura", icon: Building2 },
    { href: "/admin/equipos", label: "Equipos", icon: Cpu },
    { href: "/admin/qr", label: "Códigos QR", icon: QrCode },
    { href: "/admin/organizacion", label: "Organización", icon: Boxes },
    { href: "/admin/configuracion", label: "Configuración", icon: Settings },
    { href: "/admin/ui", label: "Catálogo UI", icon: Palette },
    { href: "/admin/reportes", label: "Reportes", icon: BarChart3 },
    { href: "/admin/auditoria", label: "Auditoría", icon: ScrollText },
  ],
};

export const loginNavItem: NavItem = { href: "/login", label: "Iniciar sesión", icon: LogIn };
