import { defineRailway, project, service } from "railway/iac";

// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "outstanding-fascination";

export default defineRailway(() => {
  const outstanding_fascination = service("outstanding-fascination", {
    start: "./start.sh",
    healthcheck: "/api/v1/health/readiness",
    healthcheckTimeout: 100,
    // dockerfilePath from CaC: "services/api/Dockerfile"
    // builder from CaC: "DOCKERFILE"
  });
  return project("meticulous-manifestation", {
    resources: [outstanding_fascination],
  });
});
