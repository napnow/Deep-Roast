export function shouldShowInvitationPanel(data: { eligible: boolean }): boolean {
  return data.eligible;
}

export function formatInvitationUsername(input: {
  snapshot: string;
  current?: string | null;
}): string {
  return input.current?.trim() || input.snapshot;
}
