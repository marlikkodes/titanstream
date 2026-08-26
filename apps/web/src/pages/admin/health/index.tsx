import type React from 'react';
import { useState, useEffect } from 'react';
import { operationsService, type MissionControlData } from '@/services/operationsService';
import { HealthWidget } from '@/components/admin/HealthWidget';
import { MetricCard, MetricCardGrid } from '@/components/admin/MetricCard';

export const HealthPage: React.FC = () => {
  const [data, setData] = useState<MissionControlData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    operationsService
      .getMissionControlOverview()
      .then((res) => setData(res))
      .catch((err) => console.warn('Failed to load health probes:', err))
      .finally(() => setLoading(false));
  }, []);

  const health = data?.system_health;

  const probeServices = [
    {
      name: 'PostgreSQL Database Engine',
      status: health?.database === 'UP' ? ('operational' as const) : ('down' as const),
      uptime: 99.98,
      latency: 12,
      load: 35,
    },
    {
      name: 'NestJS REST & Gateway API',
      status: health?.api === 'UP' ? ('operational' as const) : ('down' as const),
      uptime: 99.99,
      latency: 18,
      load: 42,
    },
    {
      name: 'Treasury Reserve Pool',
      status: health?.treasury_reserve === 'HEALTHY' ? ('operational' as const) : ('degraded' as const),
      uptime: 100.0,
      latency: 5,
      load: 20,
    },
    {
      name: 'Operations Queue & Worker',
      status: health?.worker_queue === 'HEALTHY' ? ('operational' as const) : ('degraded' as const),
      uptime: 99.9,
      latency: 25,
      load: 48,
    },
  ];

  const operationalCount = probeServices.filter((s) => s.status === 'operational').length;
  const degradedCount = probeServices.filter((s) => s.status !== 'operational').length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <MetricCardGrid columns={2}>
        <MetricCard label="Probes Operational" value={operationalCount.toString()} icon="CheckCircle" variant="green" />
        <MetricCard label="Degraded / Attention" value={degradedCount.toString()} icon="AlertTriangle" variant={degradedCount > 0 ? 'gold' : 'green'} />
      </MetricCardGrid>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {probeServices.map((service) => (
          <HealthWidget
            key={service.name}
            name={service.name}
            status={service.status}
            uptime={service.uptime}
            latency={service.latency}
            load={service.load}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-card-bg rounded-2xl p-4 sm:p-5 border border-white/10 space-y-3 shadow-lg">
          <h3 className="text-sm font-extrabold text-text-primary">Compute & Node Capacity</h3>
          <div className="grid grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
              <span className="text-text-tertiary text-[10px]">Total Hashrate</span>
              <div className="text-sm font-extrabold text-usdt-green">
                {(data?.capacity_summary?.total_capacity_ghs || 0).toLocaleString()} GH/s
              </div>
            </div>
            <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
              <span className="text-text-tertiary text-[10px]">Active Nodes</span>
              <div className="text-sm font-extrabold text-text-primary">
                {data?.capacity_summary?.active_nodes || 1} Nodes
              </div>
            </div>
            <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
              <span className="text-text-tertiary text-[10px]">Utilization</span>
              <div className="text-sm font-extrabold text-amber-400">
                {data?.capacity_summary?.capacity_utilization_percent || 0}%
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card-bg rounded-2xl p-4 sm:p-5 border border-white/10 space-y-3 shadow-lg">
          <h3 className="text-sm font-extrabold text-text-primary">Operational Queue Pressure</h3>
          <div className="grid grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
              <span className="text-text-tertiary text-[10px]">Orders Pending</span>
              <div className="text-sm font-extrabold text-ton-blue">
                {data?.operational_queues?.payment_orders_pending || 0}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
              <span className="text-text-tertiary text-[10px]">Open Ops Tasks</span>
              <div className="text-sm font-extrabold text-text-primary">
                {data?.operational_queues?.operations_queue_open || 0}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-control-bg border border-white/5 space-y-1">
              <span className="text-text-tertiary text-[10px]">Active Incidents</span>
              <div className="text-sm font-extrabold text-rose-400">
                {data?.operational_queues?.active_incidents || 0}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
