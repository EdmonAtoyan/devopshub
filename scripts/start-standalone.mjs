import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [];
let shuttingDown = false;
loadEnvFile(path.join(process.cwd(), ".env"));
process.env.NODE_ENV ||= "production";
const apiPort = process.env.API_PORT || "4000";
const webPort = process.env.PORT || process.env.WEB_PORT || "3000";

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    shutdown(signal);
  });
}

process.on("exit", () => {
  terminateChildren("SIGTERM");
});

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  await ensurePortAvailable(apiPort, "API_PORT", "api");
  await ensurePortAvailable(webPort, "PORT or WEB_PORT", "web");
  await ensureBuildArtifacts();
  await runCommand(["run", "db:migrate:deploy"]);

  const api = startProcess("api", ["--workspace", "@devops-community/api", "run", "start"], {
    API_PORT: apiPort,
  });
  const web = startProcess("web", ["--workspace", "@devops-community/web", "run", "start"], {
    PORT: webPort,
  });

  children.push(api, web);
}

function runCommand(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Command ${args.join(" ")} exited via ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`Command ${args.join(" ")} exited with code ${code}`));
        return;
      }

      resolve();
    });
  });
}

function ensurePortAvailable(port, envName, serviceName) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();

    server.on("error", (error) => {
      if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
        reject(
          new Error(`[bootstrap] Port ${port} is already in use. Stop the existing ${serviceName} process or set ${envName} to a different port.`),
        );
        return;
      }

      if (error && typeof error === "object" && "code" in error && (error.code === "EACCES" || error.code === "EPERM")) {
        reject(new Error(`[bootstrap] Unable to probe port ${port} (${error.code}).`));
        return;
      }

      reject(error);
    });

    server.listen({ host: "0.0.0.0", port: Number(port), exclusive: true }, () => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });
}

async function ensureBuildArtifacts() {
  const workspaceRoot = process.cwd();
  const apiEntry = path.join(workspaceRoot, "apps/api/dist/main.js");
  const webBuildId = path.join(workspaceRoot, "apps/web/.next/BUILD_ID");

  if (!existsSync(apiEntry)) {
    console.log("[bootstrap] API build missing. Running build:api.");
    await runCommand(["run", "build:api"]);
  }

  if (!existsSync(webBuildId)) {
    console.log("[bootstrap] Web production build missing. Running build:web.");
    await runCommand(["run", "build:web"]);
  }
}

function startProcess(name, args, extraEnv) {
  const child = spawn(npmCommand, args, {
    cwd: process.cwd(),
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(`[${name}] failed to start`, error);
    shutdown("SIGTERM", 1);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;

    if (signal) {
      console.error(`[${name}] exited via ${signal}`);
      shutdown("SIGTERM", 1);
      return;
    }

    shutdown("SIGTERM", code ?? 1);
  });

  return child;
}

function terminateChildren(signal) {
  for (const child of children) {
    terminateChild(child, signal);
  }
}

function terminateChild(child, signal) {
  if (!child?.pid) return;
  if (child.exitCode !== null || child.signalCode !== null) return;

  try {
    if (process.platform !== "win32") {
      process.kill(-child.pid, signal);
      return;
    }

    child.kill(signal);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ESRCH") return;
    console.error("[bootstrap] Failed to stop child process", error);
  }
}

function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  terminateChildren(signal);

  const timer = setTimeout(() => {
    process.exit(exitCode);
  }, 50);
  timer.unref();
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;

  const contents = readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "");
    }

    process.env[key] = value.replace(/\\n/g, "\n");
  }
}
