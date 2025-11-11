'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Home,
  Mail,
  Shield,
  AlertTriangle,
  Eye,
  Key,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Browser Streaming', href: '/dashboard/session', icon: Eye },
  { name: 'Aliases', href: '/dashboard/aliases', icon: Mail },
  { name: 'Breach Detection', href: '/dashboard/breaches', icon: Shield },
  // { name: 'Incidents', href: '/dashboard/incidents', icon: AlertTriangle },
  // { name: 'Monitoring', href: '/dashboard/monitoring', icon: Eye },
  { name: 'Password Check', href: '/dashboard/passwords', icon: Key },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null; // prevent hydration mismatch

  return (
    <>
      {/* ===== MOBILE SIDEBAR ===== */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden transition-all duration-300',
          open ? 'opacity-100 visible' : 'opacity-0 invisible'
        )}
      >
        {/* Dimmed background */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Sidebar panel */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 flex w-64 flex-col transform bg-background border-r border-border shadow-lg transition-transform duration-300',
            open ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* Header */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">
              SecurityHub
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>

          {/* Nav links */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ===== DESKTOP SIDEBAR ===== */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col border-r border-border bg-background transition-colors">
        <div className="flex flex-col flex-grow">
          {/* Logo / Header */}
          <div className="flex h-16 items-center px-6 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">
              SecurityHub
            </h2>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
