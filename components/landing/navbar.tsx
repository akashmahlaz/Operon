"use client"
import { useState, useRef } from 'react';
import Link from "next/link";
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import { OperonWordmark } from "@/components/brand";
import { useOperonSession } from "@/components/ui/session-provider";

/* ── Dropdown Data ── */
const navDropdowns: Record<
  string,
  { sections: { title: string; items: { name: string; desc: string; href: string }[] }[] }
> = {
  PLATFORM: {
    sections: [
      {
        title: 'Automation',
        items: [
          { name: 'Chat AI', desc: 'Talk to Operon via WhatsApp or web', href: '/dashboard/chat' },
          { name: 'Agents', desc: 'Autonomous AI agents that act for you', href: '/agents' },
          { name: 'Workflows', desc: 'Multi-step automation pipelines', href: '/skills' },
          { name: 'Integrations', desc: '30+ app connectors built-in', href: '/#integrations' },
        ],
      },
      {
        title: 'Infrastructure',
        items: [
          { name: 'AI Models', desc: 'GPT-4o, Claude, Gemini and more', href: '/settings' },
          { name: 'Channels', desc: 'WhatsApp, Telegram, Web chat', href: '/channels' },
        ],
      },
    ],
  },
  'USE CASES': {
    sections: [
      {
        title: 'Industries',
        items: [
          { name: 'Digital Marketing', desc: 'Create and publish ads from chat', href: '/social' },
          { name: 'Trading', desc: 'Auto-trade on Binance via commands', href: '/trading' },
          { name: 'Development', desc: 'Deploy code, manage repos', href: '/coding' },
          { name: 'Content Creation', desc: 'Generate videos and publish', href: '/#features' },
        ],
      },
      {
        title: 'Roles',
        items: [
          { name: 'Founders', desc: 'Run your business from WhatsApp', href: '/#how-it-works' },
          { name: 'Professionals', desc: 'Automate admin and scheduling', href: '/#how-it-works' },
        ],
      },
    ],
  },
  RESOURCES: {
    sections: [
      {
        title: 'Learn',
        items: [
          { name: 'Blog', desc: 'Updates and product announcements', href: '/blog' },
          { name: 'Documentation', desc: 'Guides and API reference', href: '/docs' },
          { name: 'Changelog', desc: 'What\'s new in Operon', href: '/changelog' },
        ],
      },
    ],
  },
  COMPANY: {
    sections: [
      {
        title: 'About',
        items: [
          { name: 'About Us', desc: 'Our mission and team', href: '/about' },
          { name: 'Careers', desc: 'Join Operon', href: '/careers' },
          { name: 'Contact', desc: 'Get in touch', href: '/contact' },
        ],
      },
    ],
  },
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { user } = useOperonSession()
  const isLoggedIn = !!user

  const handleMouseEnter = (label: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setActiveDropdown(label)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setActiveDropdown(null), 150)
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-2xl border-b border-border/60">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0 -ml-1">
          <OperonWordmark height={24} className="text-foreground" />
        </Link>

        {/* Desktop Nav — mega dropdown */}
        <div className="hidden md:flex items-center gap-1">
          {Object.keys(navDropdowns).map((label) => (
            <div
              key={label}
              className="relative"
              onMouseEnter={() => handleMouseEnter(label)}
              onMouseLeave={handleMouseLeave}
            >
              <button
                className={`flex items-center gap-1 px-4 py-2 text-xs font-semibold tracking-widest transition-colors rounded-lg hover:bg-accent ${
                  activeDropdown === label ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {label}
                <ChevronDown
                  className={`size-3 transition-transform duration-200 ${activeDropdown === label ? 'rotate-180' : ''}`}
                />
              </button>

              {activeDropdown === label && (
                  <div
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-1 min-w-85 animate-in fade-in slide-in-from-top-2 duration-150 rounded-2xl border border-border bg-popover p-5 text-popover-foreground shadow-2xl shadow-black/10"
                    onMouseEnter={() => handleMouseEnter(label)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div
                      className={`grid gap-6 ${
                        navDropdowns[label].sections.length > 1
                          ? 'grid-cols-2'
                          : 'grid-cols-1'
                      }`}
                    >
                      {navDropdowns[label].sections.map((section) => (
                        <div key={section.title}>
                          <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-3">
                            {section.title}
                          </p>
                          <div className="space-y-1">
                            {section.items.map((item) => (
                              <a
                                key={item.name}
                                href={item.href}
                                className="group flex flex-col px-3 py-2.5 rounded-xl hover:bg-accent transition-colors"
                              >
                                <span className="text-sm font-semibold text-foreground flex items-center gap-1">
                                  {item.name}
                                  <ArrowRight className="size-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                                </span>
                                <span className="text-xs text-muted-foreground mt-0.5">
                                  {item.desc}
                                </span>
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          {isLoggedIn ? (
            <Link
              href="/dashboard/chat"
              className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-all shadow-[inset_0_0_12px_rgba(255,255,255,0.3)]"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-5 py-2.5 border border-border text-muted-foreground text-sm font-medium rounded-full hover:bg-accent hover:text-foreground transition-all"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-all shadow-[inset_0_0_12px_rgba(255,255,255,0.3)]"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 -mr-2 text-muted-foreground hover:text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
          <div
            className="md:hidden animate-in fade-in slide-in-from-top-2 duration-200 border-t border-border bg-background overflow-hidden"
          >
            <div className="px-6 py-4 space-y-1">
              {Object.keys(navDropdowns).map((label) => (
                <button
                  key={label}
                  className="block w-full text-left text-xs font-bold tracking-widest text-muted-foreground py-3 border-b border-border/60"
                >
                  {label}
                </button>
              ))}
              <div className="pt-4 space-y-3">
                {isLoggedIn ? (
                  <Link
                    href="/dashboard/chat"
                    className="block w-full text-center px-5 py-3 bg-gray-900 text-white text-sm font-medium rounded-full"
                  >
                    Dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/signup"
                      className="block w-full text-center px-5 py-3 bg-gray-900 text-white text-sm font-medium rounded-full"
                    >
                      Get Started
                    </Link>
                    <Link
                      href="/login"
                      className="block w-full text-center px-5 py-3 border border-border text-muted-foreground text-sm font-medium rounded-full hover:bg-accent hover:text-foreground"
                    >
                      Log in
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
    </nav>
  )
}
