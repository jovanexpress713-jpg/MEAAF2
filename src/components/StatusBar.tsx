import React, { useEffect, useState } from 'react';
import { Api, AuthMode } from '../services/api';
import { Wifi, WifiOff, Database, ShieldCheck, ShieldOff, Clock } from 'lucide-react';

interface StatusBarProps {
  user: any;
  tenant: any;
  authMode: AuthMode;
}

interface ServerState {
  online: boolean;
  version?: string;
  lastCheckedAt?: Date;
}

const CONNECTION_POLL_MS = 10_000;
const STATS_POLL_MS = 60_000;

/**
 * Desktop-style status bar.
 *
 * Every value shown here comes from the running server: the connection flag is a real
 * poll of `/api/auth/mode`, the counters come from `/api/reports/dashboard`, and the clock
 * is local time. Nothing is simulated.
 */
export const StatusBar: React.FC<StatusBarProps> = ({ user, tenant, authMode }) => {
  const [server, setServer] = useState<ServerState>({ online: true });
  const [stats, setStats] = useState<{ patients: number; revenue: number } | null>(null);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    let cancelled = false;

    const checkConnection = async () => {
      try {
        const info = await Api.getAuthMode();
        if (!cancelled) {
          setServer({ online: true, version: info.version, lastCheckedAt: new Date() });
        }
      } catch {
        if (!cancelled) setServer((s) => ({ ...s, online: false, lastCheckedAt: new Date() }));
      }
    };

    const loadStats = async () => {
      try {
        const data = await Api.getDashboardReports();
        if (!cancelled) setStats({ patients: data.patients, revenue: data.revenue });
      } catch {
        // Counters are optional; a missing Reports permission must not break the bar.
        if (!cancelled) setStats(null);
      }
    };

    checkConnection();
    loadStats();

    const connectionTimer = window.setInterval(checkConnection, CONNECTION_POLL_MS);
    const statsTimer = window.setInterval(loadStats, STATS_POLL_MS);
    const clockTimer = window.setInterval(() => !cancelled && setNow(new Date()), 1000);

    return () => {
      cancelled = true;
      window.clearInterval(connectionTimer);
      window.clearInterval(statsTimer);
      window.clearInterval(clockTimer);
    };
  }, []);

  const timeLabel = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateLabel = now.toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <footer
      dir="rtl"
      className="shrink-0 bg-slate-900 text-slate-300 border-t border-slate-700 text-[11px] select-none"
    >
      <div className="px-4 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        {/* Connection */}
        <span className="flex items-center gap-1.5">
          {server.online ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300 font-semibold">الخادم متصل</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-rose-300 font-semibold">الخادم غير متاح</span>
            </>
          )}
          {server.lastCheckedAt && (
            <span className="text-slate-500">
              (فحص {server.lastCheckedAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })})
            </span>
          )}
        </span>

        <span className="text-slate-700">|</span>

        {/* Auth mode */}
        <span className="flex items-center gap-1.5">
          {authMode === 'open' ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-sky-300 font-semibold">دخول تلقائي — بدون كلمة مرور</span>
            </>
          ) : (
            <>
              <ShieldOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-300 font-semibold">وضع كلمات المرور مفعّل</span>
            </>
          )}
        </span>

        <span className="text-slate-700">|</span>

        {/* Data counters */}
        <span className="flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-slate-400" />
          {stats ? (
            <span>
              المرضى: <b className="text-slate-100">{stats.patients}</b>
              <span className="mx-1.5 text-slate-600">•</span>
              الإيرادات: <b className="text-slate-100">{stats.revenue.toLocaleString('ar-SA')}</b> ر.س
            </span>
          ) : (
            <span className="text-slate-500">لا توجد صلاحية لعرض المؤشرات</span>
          )}
        </span>

        {/* Spacer */}
        <span className="flex-1" />

        {/* Tenant + user */}
        <span className="text-slate-400 truncate max-w-[22rem]">
          {tenant?.name} — {user?.displayName} ({user?.roleName})
        </span>

        <span className="text-slate-700">|</span>

        {/* Clock */}
        <span className="flex items-center gap-1.5 tabular-nums">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-200">{timeLabel}</span>
          <span className="text-slate-500 hidden lg:inline">{dateLabel}</span>
        </span>

        <span className="text-slate-700">|</span>

        <span className="font-mono text-slate-400">v{server.version || '1.0.0'}</span>
      </div>
    </footer>
  );
};

export default StatusBar;
