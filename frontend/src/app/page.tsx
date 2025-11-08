import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-4xl flex-col items-center gap-12 px-4 py-16 text-center sm:px-8">
        <div className="flex flex-col items-center gap-4">
          <Image
            className="dark:invert"
            src="/sentinel-logo.svg" 
            alt="SentinelID Logo"
            width={120}
            height={40}
            priority
          />
          <h1 className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50 sm:text-5xl">
            Welcome to SentinelID
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Your all-in-one solution for secure identity management, breach detection, and proactive online safety.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Alias Management</CardTitle>
              <CardDescription>
                Create and manage unique email aliases to protect your real identity from data breaches and spam.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a href="/aliases" className="text-blue-500 hover:underline">
                Go to Aliases
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Breach Detection</CardTitle>
              <CardDescription>
                Check if your emails or passwords have been compromised in known data breaches.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a href="/leak-check" className="text-blue-500 hover:underline">
                Check for Leaks
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Secure Sessions</CardTitle>
              <CardDescription>
                Monitor browsing sessions and get AI-powered recommendations to prevent malicious activities.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a href="/sessions" className="text-blue-500 hover:underline">
                Manage Sessions
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Incident Correlation</CardTitle>
              <CardDescription>
                Automatically correlate detected leaks with user sessions to identify the source of a breach.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a href="/incident-correlation" className="text-blue-500 hover:underline">
                View Incidents
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Register</CardTitle>
              <CardDescription>
                Create a new account to start using SentinelID.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a href="/register" className="text-blue-500 hover:underline">
                Register Now
              </a>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
