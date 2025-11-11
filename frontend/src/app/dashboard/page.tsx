'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  AlertTriangle,
  Mail,
  Key,
  TrendingUp,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  MoreHorizontal,
  RefreshCw,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  const currentTheme = theme === 'system' ? systemTheme : theme;
  if (!mounted) return null; // avoid hydration mismatch

  // Sample data
  const securityScore = 78;
  const recentEvents = [
    {
      id: 1,
      type: 'breach',
      title: 'New breach detected',
      description: 'Alias email compromised in data breach',
      severity: 'high',
      time: '2 hours ago',
      status: 'active',
    },
    {
      id: 2,
      type: 'suspicious',
      title: 'Suspicious activity detected',
      description: 'Unusual login pattern from new location',
      severity: 'medium',
      time: '5 hours ago',
      status: 'investigating',
    },
    {
      id: 3,
      type: 'alias',
      title: 'New alias created',
      description: 'Email alias generated for shopping site',
      severity: 'low',
      time: '1 day ago',
      status: 'resolved',
    },
  ];

  const quickActions = [
    { id: 1, title: 'Create New Alias', icon: Mail, color: 'blue' },
    { id: 2, title: 'Check Email Breach', icon: Shield, color: 'green' },
    { id: 3, title: 'Test Password Strength', icon: Key, color: 'purple' },
    { id: 4, title: 'View Security Report', icon: TrendingUp, color: 'orange' },
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border border-gray-200 dark:border-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'investigating':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 bg-background text-foreground transition-colors">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Security Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor and manage your security infrastructure
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setTheme(currentTheme === 'dark' ? 'light' : 'dark')
            }
            aria-label="Toggle theme"
          >
            {currentTheme === 'dark' ? (
              <Sun className="h-4 w-4 text-yellow-400" />
            ) : (
              <Moon className="h-4 w-4 text-slate-700" />
            )}
          </Button>
          <Button variant="outline" size="sm" className="gap-1">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" className="gap-1">
            <Activity className="h-4 w-4" />
            Full Report
          </Button>
        </div>
      </div>

      {/* Security Score */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Overall Security Score</CardTitle>
            <Badge variant="outline" className="bg-background/60">
              Last updated: 2 hours ago
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl font-bold text-blue-700 dark:text-blue-400">
              {securityScore}%
            </span>
            <div className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400">
              <TrendingUp className="h-4 w-4" />
              <span>+5% from last month</span>
            </div>
          </div>
          <Progress value={securityScore} className="h-3 mb-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Needs improvement</span>
            <span>Good</span>
            <span>Excellent</span>
          </div>
        </CardContent>
      </Card>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: 'Total Aliases',
            value: '24',
            color: 'blue',
            icon: Mail,
            subtitle: '+3 from last month',
          },
          {
            title: 'Active Breaches',
            value: '2',
            color: 'red',
            icon: Shield,
            subtitle: 'Requires attention',
          },
          {
            title: 'Open Incidents',
            value: '5',
            color: 'yellow',
            icon: AlertTriangle,
            subtitle: '-2 from last week',
          },
          {
            title: 'Compromised Passwords',
            value: '1',
            color: 'purple',
            icon: Key,
            subtitle: 'Update recommended',
          },
        ].map((stat) => (
          <Card
            key={stat.title}
            className="transition-all hover:shadow-md dark:hover:shadow-lg"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div
                className={cn(
                  'p-2 rounded-full',
                  `bg-${stat.color}-100 dark:bg-${stat.color}-900/50`
                )}
              >
                <stat.icon
                  className={`h-4 w-4 text-${stat.color}-600 dark:text-${stat.color}-400`}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.subtitle}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Events + Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Events */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Security Events</CardTitle>
              <CardDescription>
                Latest security activities and alerts
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1">
              View all
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="resolved">Resolved</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="space-y-4 pt-4">
                {recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className={cn(
                        'p-2 rounded-full',
                        event.type === 'breach'
                          ? 'bg-red-100 dark:bg-red-900/50'
                          : event.type === 'suspicious'
                          ? 'bg-yellow-100 dark:bg-yellow-900/50'
                          : 'bg-green-100 dark:bg-green-900/50'
                      )}
                    >
                      {event.type === 'breach' ? (
                        <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
                      ) : event.type === 'suspicious' ? (
                        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      ) : (
                        <Mail className="h-5 w-5 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{event.title}</p>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(event.status)}
                          <Badge
                            className={cn(
                              'text-xs font-medium capitalize',
                              getSeverityColor(event.severity)
                            )}
                          >
                            {event.severity}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {event.description}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{event.time}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common security utilities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickActions.map((action) => (
              <Button
                key={action.id}
                className="justify-start w-full h-auto p-3 hover:translate-x-1 transition-transform"
                variant="outline"
              >
                <div
                  className={cn(
                    'p-2 rounded-full mr-3',
                    action.color === 'blue'
                      ? 'bg-blue-100 dark:bg-blue-900/50'
                      : action.color === 'green'
                      ? 'bg-green-100 dark:bg-green-900/50'
                      : action.color === 'purple'
                      ? 'bg-purple-100 dark:bg-purple-900/50'
                      : 'bg-orange-100 dark:bg-orange-900/50'
                  )}
                >
                  <action.icon
                    className={cn(
                      'h-4 w-4',
                      action.color === 'blue'
                        ? 'text-blue-600 dark:text-blue-400'
                        : action.color === 'green'
                        ? 'text-green-600 dark:text-green-400'
                        : action.color === 'purple'
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-orange-600 dark:text-orange-400'
                    )}
                  />
                </div>
                <span className="font-medium">{action.title}</span>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
