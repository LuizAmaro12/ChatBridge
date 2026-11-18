import type { NextConfig } from 'next';

const config: NextConfig = {
  // The repository's AGENTS.md is maintained by the project, not the dev server.
  agentRules: false,
};

export default config;
