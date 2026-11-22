// Keep entry checks independent of login/OTP and discard requests from old routes/accounts.
export type ContractEntryState = {
  path: string;
  phase: "checking" | "allowed" | "redirecting" | "error";
  destination?: string;
};

const entryRoutes = new Set([
  "/", "/otp", "/bootstrap", "/driver-contract", "/support",
  "/driver-profile/create", "/driver-profile/pending",
  "/driver-profile/rejected", "/driver-profile/suspended",
]);

export function requiresContractEntryCheck(path: string) {
  return !entryRoutes.has(path.replace(/\/+$/, "") || "/");
}

type Agreement = { needsAcceptance?: boolean; profile: unknown };

export function createContractEntryChecker(dependencies: {
  getToken: () => Promise<string | null>;
  loadAgreement: (token: string) => Promise<Agreement>;
  onState: (state: ContractEntryState) => void;
}) {
  let generation = 0;
  return {
    cancel() { generation += 1; },
    async check(path: string): Promise<void> {
      const request = ++generation;
      if (!requiresContractEntryCheck(path)) return;
      dependencies.onState({ path, phase: "checking" });
      try {
        const token = await dependencies.getToken();
        if (request !== generation) return;
        if (!token) {
          dependencies.onState({ path, phase: "redirecting", destination: "/" });
          return;
        }
        const agreement = await dependencies.loadAgreement(token);
        const latestToken = await dependencies.getToken();
        if (request !== generation) return;
        if (latestToken !== token) {
          // Recheck the current account; an old response must never unlock the screen.
          return this.check(path);
        }
        if (!agreement?.profile) {
          dependencies.onState({ path, phase: "redirecting", destination: "/bootstrap" });
        } else if (agreement.needsAcceptance === true) {
          dependencies.onState({ path, phase: "redirecting", destination: "/driver-contract?required=1" });
        } else if (agreement.needsAcceptance === false) {
          dependencies.onState({ path, phase: "allowed" });
        } else {
          throw new Error("Missing contract acceptance status");
        }
      } catch {
        if (request === generation) dependencies.onState({ path, phase: "error" });
      }
    },
  };
}
