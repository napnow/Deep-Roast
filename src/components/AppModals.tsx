"use client";

import SettingsModal from "@/components/Settings/SettingsModal";
import CreditWalletModal from "@/components/CreditWalletModal";
import ChangePasswordModal from "@/components/Auth/ChangePasswordModal";
import ApiKeysModal from "@/components/ApiKeysModal";
import DonationModal from "@/components/DonationModal";
import { useDeepRoastStore } from "@/lib/store";
import type { Config } from "@/types";

interface AppModalsProps {
  onSaveConfig: (updates: Record<string, unknown>) => Promise<void>;
  role: string;
  donationOpen: boolean;
  onDonationClose: () => void;
  checkinLoading?: boolean;
  onCheckinClick: () => void;
}

/** 设置 / 钱包 模态框 */
export default function AppModals({
  onSaveConfig,
  role,
  donationOpen,
  onDonationClose,
  checkinLoading,
  onCheckinClick,
}: AppModalsProps) {
  const {
    config,
    credits,
    checkinReward,
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
        checkinReward={checkinReward}
        role={role}
        checkinEligible={checkinEligible}
        todayChecked={todayChecked}
        checkinLoading={checkinLoading}
        onCheckinClick={onCheckinClick}
      />

      <DonationModal open={donationOpen} onClose={onDonationClose} />

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
