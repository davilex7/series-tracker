import {
  ArrowRight,
  Check,
  ChevronsUpDown,
  Circle,
  Copy,
  Edit,
  ExternalLink,
  File,
  HelpCircle,
  Home,
  Loader2,
  Mail,
  MessageSquare,
  Moon,
  Plus,
  PlusCircle,
  RefreshCw, // <-- Add RefreshCw
  Search,
  Server,
  Settings,
  Share2,
  Shield,
  Sun,
  Trash,
  User,
  Wand, // <-- Add Wand
  Workflow,
  X
} from 'lucide-react';

const Icons = {
  arrowRight: ArrowRight,
  check: Check,
  chevronDown: ChevronsUpDown, // Keep existing alias if used elsewhere
  chevronsUpDown: ChevronsUpDown, // Add alias if needed, or just use chevronDown
  circle: Circle,
  workflow: Workflow,
  close: X,
  copy: Copy,
  dark: Moon,
  edit: Edit,
  externalLink: ExternalLink,
  file: File,
  help: HelpCircle,
  home: Home,
  light: Sun,
  loader: Loader2,
  mail: Mail,
  messageSquare: MessageSquare,
  plus: Plus,
  plusCircle: PlusCircle,
  refreshCw: RefreshCw, // <-- Export RefreshCw
  search: Search,
  server: Server,
  settings: Settings,
  share: Share2,
  shield: Shield,
  spinner: Loader2, // Keep spinner alias if used
  trash: Trash,
  user: User,
  wand: Wand, // <-- Export Wand
};

export {Icons};
