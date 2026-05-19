export default {
  routes: [
    { method: "POST", path: "/tasks/:id/submit",          handler: "task-custom.submit",         config: { middlewares: ["api::task.task-owner-only"], policies: [] } },
    { method: "POST", path: "/tasks/:id/approve",         handler: "task-custom.approve",        config: { policies: ["api::task.is-manager"] } },
    { method: "POST", path: "/tasks/:id/reject",          handler: "task-custom.reject",         config: { policies: ["api::task.is-manager"] } },
    { method: "POST", path: "/tasks/:id/handover",        handler: "task-custom.handover",       config: { middlewares: ["api::task.task-owner-only"], policies: [] } },
    { method: "POST", path: "/tasks/:id/request-pickup",  handler: "task-custom.requestPickup",  config: { policies: [] } },
    { method: "POST", path: "/tasks/:id/cancel-pickup",   handler: "task-custom.cancelPickup",   config: { policies: [] } },
    { method: "POST", path: "/tasks/:id/approve-pickup",  handler: "task-custom.approvePickup",  config: { policies: ["api::task.is-manager"] } },
    { method: "GET",  path: "/tasks/:id/signed-url",      handler: "task-custom.signedUrl",      config: { policies: ["api::task.is-manager"] } },
  ],
};
