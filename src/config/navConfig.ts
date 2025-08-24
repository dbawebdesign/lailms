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
  HelpCircle,
  MessageSquare,
  Briefcase,
  FileText,
  SlidersHorizontal,
  Building,
  BookMarked,
  PenTool,
  MessageCircle,
  Wrench,
  Play,
} from "lucide-react";
import { UserRole } from "@/lib/utils/roleUtils";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  children?: NavItem[]; // For collapsible groups
  isBottom?: boolean; // To group items at the bottom
};

// Helper function to create common bottom items
const createBottomNavItems = (roles: UserRole[]): NavItem[] => [
  {
    title: "Quick Guide",
    href: "/quick-guide",
    icon: HelpCircle,
    roles: roles,
    isBottom: true,
  },
  {
    title: "Feedback",
    href: "/feedback",
    icon: MessageSquare,
    roles: roles,
    isBottom: true,
  },
];

const allRoles: UserRole[] = ["admin", "teacher", "student", "parent", "super_admin"];

const navConfig: NavItem[] = [
  // Student Specific
  {
    title: "Home",
    href: "/learn",
    icon: Home,
    roles: ["student"],
  },
  {
    title: "My Courses",
    href: "/learn/courses", // Main entry for course player
    icon: BookOpen,
    roles: ["student"],
  },
  {
    title: "Study Space", // Previously Notebook LM
    href: "/learn/notebook", // As per PRD: /learn/notebook/:id
    icon: NotebookText,
    roles: ["student"],
  },
  {
    title: "Progress",
    href: "/learn/progress",
    icon: BarChart3, // Using BarChart3 instead of GraduationCap for progress
    roles: ["student"],
  },
  {
    title: "Community",
    href: "/learn/community",
    icon: MessageCircle,
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
    title: "Home", // Teacher Home
    href: "/teach",
    icon: Home,
    roles: ["teacher"],
  },
  {
    title: "Base Classes",
    href: "/teach/base-classes",
    icon: Library,
    roles: ["teacher"],
  },
  {
    title: "Class Instances",
    href: "/teach/instances",
    icon: School,
    roles: ["teacher"],
  },
  {
    title: "Knowledge Base",
    href: "/teach/knowledge",
    icon: BookMarked,
    roles: ["teacher"],
  },
  {
    title: "Gradebook",
    href: "/teach/gradebook", // PRD: /teach/gradebook/:classId
    icon: ClipboardList,
    roles: ["teacher"],
  },
  {
    title: "Teacher Tools",
    href: "/teach/tools",
    icon: Wrench, // Changed from UserCog to Wrench
    roles: ["teacher"],
  },

  // Admin Specific
  {
    title: "School Dashboard",
    href: "/school", // PRD route
    icon: LayoutDashboard,
    roles: ["admin"],
  },
  {
    title: "Users & Roles",
    href: "/school/users", // PRD route
    icon: Users,
    roles: ["admin"],
  },
  {
    title: "Courses Overview",
    href: "/school/courses", // PRD route
    icon: BookOpen, // Re-using BookOpen
    roles: ["admin"],
  },
  {
    title: "School Analytics",
    href: "/school/analytics", // PRD route
    icon: BarChart3, // Re-using BarChart3
    roles: ["admin"],
  },

  // Super Admin Specific
  {
    title: "Org Dashboard",
    href: "/org", // PRD route
    icon: Briefcase, // Changed from LayoutDashboard
    roles: ["super_admin"],
  },
  
  // Parent Specific (from original file, kept for now)
  {
      title: "My Children",
      href: "/parent/children",
      icon: Users,
      roles: ["parent"],
  },

  // Common Bottom Items for all roles
  ...createBottomNavItems(allRoles),
];

export default navConfig; 