'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Menu,
  LogOut,
  Settings,
  Sun,
  Moon,
  Palette,
  ChevronRight,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { themes } from '@/lib/theme';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [userEmail, setUserEmail] = useState('user@example.com');
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setIsMounted(true);
    const email = localStorage.getItem('user_email') || 'user@example.com';
    setUserEmail(email);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_email');
    router.push('/login');
  };

  if (!isMounted) {
    return (
      <header className="flex h-16 items-center justify-between bg-slate-900/80 px-6 shadow-md backdrop-blur-md border-b border-slate-800">
        <Button variant="ghost" size="icon" onClick={onMenuClick} className="lg:hidden">
          <Menu className="h-5 w-5 text-gray-300" />
        </Button>
        <div className="ml-auto flex items-center space-x-4">
          <div className="h-8 w-8 rounded-full bg-slate-700 animate-pulse" />
        </div>
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex h-16 items-center justify-between px-4 sm:px-6 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 shadow-[0_1px_0_rgba(255,255,255,0.05)]">
      {/* Left: Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="lg:hidden hover:bg-slate-800/80 text-gray-300"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Right: Actions */}
      <div className="ml-auto flex items-center space-x-2 sm:space-x-4">
        {/* Theme Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative hover:bg-slate-800/70 text-gray-300 transition-all rounded-full"
            >
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-transform duration-300 dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-transform duration-300 dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="w-40 rounded-xl border border-slate-800 bg-slate-900/95 backdrop-blur-md text-gray-200 shadow-lg"
          >
            <DropdownMenuLabel className="text-xs text-gray-400 uppercase tracking-wide">
              Theme
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            {themes.map((theme) => (
              <DropdownMenuItem
                key={theme.name}
                onClick={() => setTheme(theme.name)}
                className={cn(
                  'cursor-pointer hover:bg-slate-800/60 transition-colors dark:text-blue-400'
                )}
              >
                <Palette className="mr-2 h-4 w-4 text-slate-400" />
                {theme.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 w-9 rounded-full overflow-hidden hover:ring-2 hover:ring-blue-500/50 transition-all"
            >
              <Avatar className="h-9 w-9 border border-slate-700">
                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold">
                  {userEmail.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-56 rounded-xl border border-slate-800 bg-slate-900/95 backdrop-blur-lg text-gray-200 shadow-xl"
            align="end"
            forceMount
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold text-white">User</p>
                <p className="text-xs text-gray-400">{userEmail}</p>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="bg-slate-800" />

            <DropdownMenuItem className="hover:bg-slate-800/60 cursor-pointer">
              <Settings className="mr-2 h-4 w-4 text-gray-400" />
              <span>Settings</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-slate-800" />

            <DropdownMenuItem
              onClick={handleLogout}
              className="text-red-400 hover:bg-red-500/10 cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
              <ChevronRight className="ml-auto h-4 w-4 opacity-70" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
