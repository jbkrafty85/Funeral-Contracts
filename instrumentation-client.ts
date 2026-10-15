import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    { path: "/api/upload", method: "POST" },
    { path: "/api/submissions", method: "POST" },
  ],
});
