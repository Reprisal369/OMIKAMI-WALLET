import { ConnectPanel } from '@/components/ConnectPanel';
import { TokenBalancesPanel } from '@/components/TokenBalancesPanel';
import { ActivityPanel } from '@/components/ActivityPanel';
import { AllowanceDashboardPanel } from '@/components/AllowanceDashboardPanel';
import { SendPreviewPanel } from '@/components/SendPreviewPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { RpcStatusPanel } from '@/components/RpcStatusPanel';
import { SecurityPanel } from '@/components/SecurityPanel';

export default function PortfolioPage() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="flex flex-col gap-4 lg:col-span-3">
        <ConnectPanel />
        <TokenBalancesPanel />
        <ActivityPanel />
        <AllowanceDashboardPanel />
        <SendPreviewPanel />
        <RpcStatusPanel />
        <SettingsPanel />
      </div>
      <div className="lg:col-span-2">
        <SecurityPanel />
      </div>
    </div>
  );
}
