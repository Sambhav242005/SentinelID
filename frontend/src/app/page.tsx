'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Lock,
  Mail,
  Cpu,
  ArrowRight,
  Terminal,
  Globe,
  Network,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-gray-100 overflow-hidden">
      {/* Animated Background Lights */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute w-[40rem] h-[40rem] bg-blue-600/20 blur-3xl rounded-full top-[-10rem] left-[-10rem] animate-pulse" />
        <div className="absolute w-[40rem] h-[40rem] bg-indigo-600/30 blur-3xl rounded-full bottom-[-10rem] right-[-10rem] animate-[pulse_8s_infinite_alternate]" />
      </div>

      {/* Header */}
      <header className="relative z-20 border-b border-slate-800 bg-slate-950/70 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div
            onClick={() => router.push('/')}
            className="flex items-center space-x-2 cursor-pointer"
          >
            <Shield className="h-7 w-7 text-blue-500" />
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              SentinelID
            </span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => router.push('/login')}>
              Sign In
            </Button>
            <Button
              onClick={() => router.push('/register')}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md"
            >
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 container mx-auto px-6 py-24 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-6xl font-extrabold mb-6 leading-tight"
        >
          AI-Powered <span className="text-blue-400">Identity Protection</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="text-gray-400 max-w-2xl mx-auto text-lg mb-10"
        >
          Manage aliases, detect breaches, and automate identity defense — powered by
          <span className="text-blue-400 font-medium"> Flask + OpenRouter AI</span>.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-8 py-6 rounded-xl shadow-xl"
            onClick={() => router.push('/register')}
          >
            Start Protecting Now
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </section>

      {/* Live Breach Monitor Simulation */}
      <section className="relative py-24 bg-slate-900/40 border-t border-b border-slate-800">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-8">Live Identity Monitoring</h2>
          <div className="max-w-3xl mx-auto bg-slate-950/60 border border-slate-800 rounded-xl p-6 text-left font-mono text-sm text-blue-300">
            <p className="animate-pulse">[02:14:55] 🔍 Scanning global breach networks...</p>
            <p>[02:14:56] ✅ Connection established to <span className="text-indigo-400">OpenRouter Neural Shield</span></p>
            <p>[02:14:58] ⚠️ Potential alias exposure detected: <span className="text-red-400">user_shopping_alias@mail.com</span></p>
            <p>[02:15:02] 🔒 Auto-encrypting leaked credentials...</p>
            <p>[02:15:06] ✅ Secure patch applied successfully</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 container mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold mb-12">Next-Gen Security Suite</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            {
              icon: Shield,
              title: 'AI Breach Detection',
              desc: 'Instant threat analysis powered by deep learning.',
              color: 'blue',
            },
            {
              icon: Lock,
              title: 'Encrypted ID Vault',
              desc: 'Securely store all identities with AES-256 encryption.',
              color: 'purple',
            },
            {
              icon: Mail,
              title: 'Smart Alias System',
              desc: 'Generate and manage disposable email aliases.',
              color: 'green',
            },
            {
              icon: Cpu,
              title: 'Automation Engine',
              desc: 'Integrates with Flask backend to auto-patch breaches.',
              color: 'yellow',
            },
          ].map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="bg-slate-900/40 border border-slate-800 hover:border-blue-500/50 transition-all duration-300 backdrop-blur-md hover:shadow-blue-500/10">
                <CardHeader>
                  <div
                    className={cn(
                      'mx-auto p-3 rounded-full w-fit',
                      f.color === 'blue'
                        ? 'bg-blue-500/20'
                        : f.color === 'purple'
                        ? 'bg-purple-500/20'
                        : f.color === 'green'
                        ? 'bg-green-500/20'
                        : 'bg-yellow-500/20'
                    )}
                  >
                    <f.icon
                      className={cn(
                        'h-8 w-8',
                        f.color === 'blue'
                          ? 'text-blue-400'
                          : f.color === 'purple'
                          ? 'text-purple-400'
                          : f.color === 'green'
                          ? 'text-green-400'
                          : 'text-yellow-400'
                      )}
                    />
                  </div>
                  <CardTitle className="mt-4 text-lg">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{f.desc}</CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Integration Section */}
      <section className="relative py-28 bg-gradient-to-r from-slate-950 to-slate-900 text-center">
        <h2 className="text-3xl font-bold mb-10">Seamless AI Integration</h2>
        <div className="flex flex-wrap justify-center items-center gap-8">
          <div className="flex flex-col items-center">
            <Terminal className="h-10 w-10 text-blue-400 mb-2" />
            <p className="text-sm text-gray-400">Flask Backend</p>
          </div>
          <ArrowRight className="h-6 w-6 text-gray-400" />
          <div className="flex flex-col items-center">
            <Globe className="h-10 w-10 text-indigo-400 mb-2" />
            <p className="text-sm text-gray-400">OpenRouter AI</p>
          </div>
          <ArrowRight className="h-6 w-6 text-gray-400" />
          <div className="flex flex-col items-center">
            <Network className="h-10 w-10 text-green-400 mb-2" />
            <p className="text-sm text-gray-400">Playwright Automation</p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 container mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold mb-12">Trusted by Developers</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              name: 'Riya Mehta',
              role: 'Cybersecurity Analyst',
              text: '“SentinelID’s AI-driven alias protection caught leaks before my team could.”',
            },
            {
              name: 'Aniket Sharma',
              role: 'Backend Engineer',
              text: '“The Flask + OpenRouter integration is so smooth — setup took 5 minutes.”',
            },
            {
              name: 'Alex Johnson',
              role: 'DevSecOps Lead',
              text: '“This isn’t just another dashboard. It’s an autonomous identity guardian.”',
            },
          ].map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
              className="bg-slate-900/40 border border-slate-800 rounded-xl p-6 shadow-md hover:shadow-blue-500/10"
            >
              <p className="text-gray-300 italic mb-4">{t.text}</p>
              <p className="font-semibold">{t.name}</p>
              <p className="text-sm text-gray-500">{t.role}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-32 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 blur-3xl opacity-40" />
        <div className="relative z-10 container mx-auto px-6">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Secure Your Digital Identity?
          </h2>
          <p className="text-blue-100 mb-8 text-lg max-w-2xl mx-auto">
            Join the SentinelID ecosystem — where AI meets cybersecurity automation.
          </p>
          <Button
            size="lg"
            className="bg-white text-blue-700 hover:bg-blue-50 shadow-xl"
            onClick={() => router.push('/register')}
          >
            Get Started Free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-8 border-t border-slate-800 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} SentinelID — Built with Flask, OpenRouter & Next.js.
      </footer>
    </div>
  );
}
