import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getLiveState } from "../socket.js";

const router = Router();
router.use(requireAuth);

router.get("/:eventId", (req, res) => {
  res.json({ state: getLiveState(req.params.eventId) });
});

export default router;
