/* eslint-disable @typescript-eslint/no-require-imports -- Portable Node CLI and testable CommonJS entry. */
const os = require("node:os");
const MIN_BUILD_MEMORY = 2 * 1024 ** 3;

/** Refuse a build before starting the compiler on a small host or cgroup. */
function assertBuildMemory({ totalBytes, constrainedBytes = 0 }) {
  const budget = constrainedBytes > 0
    ? Math.min(totalBytes, constrainedBytes)
    : totalBytes;
  if (!Number.isFinite(budget) || budget < MIN_BUILD_MEMORY) {
    throw new Error(
      `Insufficient build memory (${Math.floor(budget / 1024 ** 2)} MiB). ` +
      "Do not compile on the production server; build on a Linux machine/CI with at least 2 GiB and upload the verified artifact.",
    );
  }
  return budget;
}

if (require.main === module) {
  try {
    const budget = assertBuildMemory({
      totalBytes: os.totalmem(),
      constrainedBytes: typeof process.constrainedMemory === "function" ? process.constrainedMemory() : 0,
    });
    console.log(`Build memory preflight: ${Math.floor(budget / 1024 ** 2)} MiB available budget.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { assertBuildMemory, MIN_BUILD_MEMORY };