"use client";

import SettingsModal from "@/components/Settings/SettingsModal";
import CreditWalletModal from "@/components/CreditWalletModal";
import ChangePasswordModal from "@/components/Auth/ChangePasswordModal";
import ApiKeysModal from "@/components/ApiKeysModal";
import { useDeepRoastStore } from "@/lib/store";
import type { Config } from "@/types";

interface AppModalsProps {
  onSaveConfig: (updates: Record<string, unknown>) => Promise<void>;
  role: string;
  checkinLoading?: boolean;
  onCheckinClick: () => void;
}

/** 设置 / 钱包 模态框 */
export default function AppModals({
  onSaveConfig,
  role,
  checkinLoading,
  onCheckinClick,
}: AppModalsProps) {
  const {
    config,
    credits,
    settingsOpen,
    setSettingsOpen,
    walletOpen,
    setWalletOpen,
    pwOpen,
    setPwOpen,
    apiOpen,
    setApiOpen,
    checkinEligible,
    todayChecked,
  } = useDeepRoastStore();

  return (
    <>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={config as Config}
        onSave={onSaveConfig}
      />

      <CreditWalletModal
        open={walletOpen}
        onClose={() => setWalletOpen(false)}
        credits={credits}
        role={role}
        checkinEligible={checkinEligible}
        todayChecked={todayChecked}
        checkinLoading={checkinLoading}
        onCheckinClick={onCheckinClick}
      />

      <ChangePasswordModal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
      />

      <ApiKeysModal
        open={apiOpen}
        onClose={() => setApiOpen(false)}
      />
    </>
  );
}
