import React, { useState } from 'react';
import {
  LayoutDashboard,
  Compass,
  Camera,
  Inbox,
  Settings,
  ShieldCheck,
  Plus,
  Users,
  Menu,
  X
} from 'lucide-react';
import { useRepository } from '../hooks/useRepository';

export type AppView =
  | 'DASHBOARD'
  | 'TOURS'
  | 'CAPTURE'
  | 'LEADS'
  | 'SETTINGS'
  | 'ADMIN'
  | 'EDITOR';

interface NavigationProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onCreateTour: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentView,
  onNavigate,
  onCreateTour
}) => {
  const { currentOrg, leads } = useRepository();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const orgLeads = leads.filter((l) => l.orgId === currentOrg.id);
  const newLeadsCount = orgLeads.filter((l) => l.status === 'NEW').length;

  const navItems = [
    { view: 'DASHBOARD' as AppView, label: 'Dashboard', icon: LayoutDashboard },
    { view: 'TOURS' as AppView, label: 'Spaces & Tours', icon: Compass },
    { view: 'CAPTURE' as AppView, label: 'Live Capture', icon: Camera },
    {
      view: 'LEADS' as AppView,
      label: 'Leads Inbox',
      icon: Inbox,
      badge: newLeadsCount > 0 ? newLeadsCount : undefined
    },
    { view: 'ADMIN' as AppView, label: 'Super Admin', icon: ShieldCheck },
    { view: 'SETTINGS' as AppView, label: 'Studio Settings', icon: Settings }
  ];

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-30 h-16 bg-[#141210]/95 backdrop-blur-md border-b border-white/10 px-4 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 -ml-2 text-[#F6F2EC] hover:text-[#D6A77A] md:hidden cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div
            onClick={() => onNavigate('DASHBOARD')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-full bg-[#D6A77A] flex items-center justify-center text-[#0E0C0A] shadow-md group-hover:scale-105 transition-transform">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-bold font-serif-heading tracking-wide text-[#F6F2EC] group-hover:text-[#D6A77A] transition-colors">
                RenderWalk
              </div>
              <div className="text-[10px] tracking-wider uppercase text-[#D6A77A] font-semibold">
                360° Spatial SaaS
              </div>
            </div>
          </div>
        </div>

        {/* Current Org Indicator & Quick Actions */}
        <div className="flex items-center gap-3">
          {/* Active Tenant Box (Desktop) */}
          <div
            onClick={() => onNavigate('ADMIN')}
            title="Switch Tenant Organization"
            className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#1B1815] border border-white/10 hover:border-[#D6A77A]/40 transition-all cursor-pointer"
          >
            <div className="w-2 h-2 rounded-full bg-[#9CC0B4]" />
            <div className="text-left">
              <div className="text-[11px] font-bold text-[#F6F2EC] line-clamp-1 max-w-[140px]">
                {currentOrg.name}
              </div>
              <div className="text-[9px] text-[#D6A77A]">{currentOrg.planName}</div>
            </div>
            <Users className="w-3.5 h-3.5 text-[#F6F2EC]/40" />
          </div>

          <button
            type="button"
            onClick={onCreateTour}
            className="h-9 px-3.5 rounded-[10px] bg-[#D6A77A] text-[#0E0C0A] hover:bg-[#e2b990] font-bold text-xs uppercase tracking-wider inline-flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline">New Tour</span>
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden bg-black/70 backdrop-blur-sm">
          <div className="fixed top-16 left-0 bottom-0 w-72 bg-[#1B1815] border-r border-white/10 p-4 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-[#141210] border border-white/10">
                <div className="text-[10px] uppercase font-bold text-[#F6F2EC]/40 mb-1">
                  Active Organization
                </div>
                <div className="text-sm font-bold text-[#F6F2EC]">{currentOrg.name}</div>
                <div className="text-xs text-[#D6A77A]">{currentOrg.planName}</div>
              </div>

              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.view;
                  return (
                    <button
                      key={item.view}
                      type="button"
                      onClick={() => {
                        onNavigate(item.view);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#D6A77A]/15 text-[#D6A77A]'
                          : 'text-[#F6F2EC]/70 hover:text-[#F6F2EC] hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className="px-1.5 py-0.5 rounded-full bg-[#D6A77A] text-[#0E0C0A] text-[10px] font-bold">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-white/10 text-[11px] text-[#F6F2EC]/40">
              RenderWalk v3.0 • Multi-tenant SaaS
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sub-navigation Header Tabs */}
      <nav className="hidden md:flex items-center gap-1 px-8 py-2 bg-[#1B1815] border-b border-white/10 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => onNavigate(item.view)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-[#D6A77A]/20 text-[#D6A77A]'
                  : 'text-[#F6F2EC]/70 hover:text-[#F6F2EC] hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#D6A77A] text-[#0E0C0A] text-[10px] font-bold">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};
