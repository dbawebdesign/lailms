import {
  LayoutDashboard,
  BookOpen,
  Users,
  Settings,
  GraduationCap,
  ClipboardList,
  UserCog,
  School,
  Library,
  NotebookText,
  BarChart3,
  UserCircle,
  Home,
  LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  children?: NavItem[]; // For collapsible groups
};

export type UserRole = "admin" | "teacher" | "student" | "parent" | "super_admin"; // Add roles as needed

const navConfig: NavItem[] = [
  // Common
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "teacher", "student", "parent", "super_admin"],
  },
  // Student Specific
  {
    title: "My Courses",
    href: "/learn/courses",
    icon: BookOpen,
    roles: ["student"],
  },
  {
    title: "Study Space",
    href: "/learn/study",
    icon: NotebookText,
    roles: ["student"],
  },
  {
    title: "Achievements",
    href: "/learn/achievements",
    icon: GraduationCap,
    roles: ["student"],
  },
  // Teacher Specific
  {
    title: "Base Classes",
    href: "/teach/base-classes",
    icon: Library,
    roles: ["teacher"],
  },
  {
    title: "Instances",
    href: "/teach/instances",
    icon: School,
    roles: ["teacher"],
  },
  {
    title: "Gradebook",
    href: "/teach/gradebook",
    icon: ClipboardList,
    roles: ["teacher"],
  },
  {
    title: "Teacher Tools",
    href: "/teach/tools",
    icon: UserCog, // Or another appropriate icon
    roles: ["teacher"],
  },
  // Admin Specific
  {
    title: "Organization",
    href: "/admin/organization",
    icon: Users, // Or Building
    roles: ["admin", "super_admin"],
  },
  {
    title: "User Management",
    href: "/admin/users",
    icon: UserCircle,
    roles: ["admin", "super_admin"],
  },
  {
    title: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
    roles: ["admin", "super_admin"],
  },
  // Parent Specific
  {
      title: "My Children",
      href: "/parent/children",
      icon: Users, // Or another icon like HeartHandshake
      roles: ["parent"],
  },
  // Common Bottom
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["admin", "teacher", "student", "parent", "super_admin"],
  },
];

export default navConfig; 