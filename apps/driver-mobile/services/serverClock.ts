import { createServerClock } from "../../mobile-chat/serverClock.js";

// One in-memory estimate for requests and countdowns. No device clock setting is modified.
export const driverServerClock = createServerClock();
