"use client";

import SettingsModal from "@/components/Settings/SettingsModal";
import CreditRechargeModal from "@/components/CreditRechargeModal";
import CreditWalletModal from "@/components/CreditWalletModal";
import { useDeepRoastStore } from "@/lib/store";
import type { Config } from "@/types";

interface AppModalsProps {
  onSaveConfig: (updates: Record<string, unknown>) => Promise<void>;
}

/** 设置 / 充值 / 钱包 三个模态框集中管理 */
export default function AppModals({ onSaveConfig }: AppModalsProps) {
  const {
    config,
    credits,
    setCredits,
    settingsOpen,
    setSettingsOpen,
    rechargeOpen,
    setRechargeOpen,
    walletOpen,
    setWalletOpen,
  } = useDeepRoastStore();

  return (
    <>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={config as Config}
        onSave={onSaveConfig}
      />

      <CreditRechargeModal
        open={rechargeOpen}
        onClose={() => setRechargeOpen(false)}
        credits={credits}
        onCreditsChange={(newBalance) => setCredits(newBalance)}
        onWalletClick={() => setWalletOpen(true)}
      />

      <CreditWalletModal
        open={walletOpen}
        onClose={() => setWalletOpen(false)}
        credits={credits}
        onRechargeClick={() => {
          setWalletOpen(false);
          setTimeout(() => setRechargeOpen(true), 200);
        }}
      />
    </>
  );
}
