import "./utils/environment.js"

import type { Worker } from "bullmq"
import startEDDNListenerProcess from "./eddn/eddn.js"
import { initMQ } from "./mq/index.js"
import logger from "./utils/logger.js"
import { Redis } from "./utils/redis.js"
import { db } from "./utils/db.js"

const result = await db.execute("select 1")

console.log(result)

let eddnProcess: ReturnType<typeof startEDDNListenerProcess> | null = null
let BullMQWorkers: Worker[] = []

// eslint-disable-next-line @typescript-eslint/no-misused-promises
Redis.on("ready", async () => {
	logger.info("[Redis] Connection established")
	BullMQWorkers = initMQ()
	if (
		process.env.NODE_ENV === "production" ||
		process.env.DEBUG_EDDN_LISTENER === "true"
	) {
		eddnProcess = startEDDNListenerProcess()
	}
})

// const KoaApp = new Koa()
// KoaApp.use((ctx) => {
//   ctx.body = {
//     status: 'ok',
//     timestamp: new Date().toISOString(),
//   }
// })
// KoaApp.listen(process.env.PORT, () => {
//   logger.info(`[Koa] Server listening on port ${process.env.PORT!}`)
// })

// Graceful shutdown
let isShuttingDown = false

const shutdown = async () => {
	if (isShuttingDown) {
		return
	}
	isShuttingDown = true

	logger.info("Shutting down...")

	// Close EDDN worker
	if (eddnProcess) {
		logger.info("[EDDN] Initiating worker shutdown")
		await eddnProcess.shutdown()
		logger.info("[EDDN] Worker terminated")
	}

	// Close BullMQ workers
	logger.info("[BullMQ] Closing workers...")
	await Promise.all(BullMQWorkers.map((worker) => worker.close()))
	logger.info("[BullMQ] All workers closed")

	// Close Redis connection
	logger.info("[Redis] Closing connection...")
	await Redis.quit()
	logger.info("[Redis] Connection closed")

	// Close Koa server
	// logger.info('[Koa] Closing server...')
	// await new Promise<void>((resolve) => {
	//   KoaApp.listen().close(() => resolve())
	// })
	// logger.info('[Koa] Server closed')

	// Give time for connections to close
	await new Promise((resolve) => {
		setTimeout(resolve, 500)
	})

	process.exit(0)
}

process.on("SIGTERM", () => {
	void shutdown()
})
process.on("SIGINT", () => {
	void shutdown()
})
