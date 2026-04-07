import assert from "node:assert/strict"
import test from "node:test"
import type { PluginConfig } from "../lib/config"
import type { Logger } from "../lib/logger"
import { insertMessageIdContext, insertPruneToolContext } from "../lib/messages/inject"
import { createSessionState, type SessionState, type WithParts } from "../lib/state"
import { countTurns, findLastCompactionTimestamp } from "../lib/state/utils"
import { isMessageCompacted } from "../lib/shared-utils"
import { getCurrentParams } from "../lib/strategies/utils"

const asMessage = (value: unknown): WithParts => value as WithParts

const createState = (): SessionState => createSessionState()

const createConfig = (): PluginConfig => ({
    enabled: true,
    debug: false,
    pruneNotification: "off",
    pruneNotificationType: "chat",
    commands: {
        enabled: true,
        protectedTools: [],
    },
    manualMode: {
        enabled: false,
        automaticStrategies: true,
    },
    turnProtection: {
        enabled: false,
        turns: 4,
    },
    protectedFilePatterns: [],
    tools: {
        settings: {
            nudgeEnabled: true,
            nudgeFrequency: 10,
            protectedTools: [],
            contextLimit: 100000,
            prunableToolsInjectionFrequency: 0,
        },
        distill: {
            permission: "allow",
            showDistillation: false,
        },
        compress: {
            permission: "allow",
            showCompression: false,
        },
        prune: {
            permission: "allow",
        },
    },
    strategies: {
        deduplication: {
            enabled: true,
            protectedTools: [],
        },
        supersedeWrites: {
            enabled: true,
        },
        purgeErrors: {
            enabled: true,
            turns: 4,
            protectedTools: [],
        },
    },
})

const createLogger = (): Logger =>
    ({
        debug() {},
        info() {},
        warn() {},
    }) as unknown as Logger

test("isMessageCompacted ignores messages without created timestamps", () => {
    const state = createState()
    state.lastCompaction = 50

    const missingCreated = asMessage({
        info: {
            id: "assistant-missing-created",
            sessionID: "session-1",
            role: "assistant",
        },
        parts: [],
    })

    const compacted = asMessage({
        info: {
            id: "assistant-compacted",
            sessionID: "session-1",
            role: "assistant",
            time: { created: 10 },
        },
        parts: [],
    })

    assert.doesNotThrow(() => isMessageCompacted(state, missingCreated))
    assert.equal(isMessageCompacted(state, missingCreated), false)
    assert.equal(isMessageCompacted(state, compacted), true)
})

test("findLastCompactionTimestamp skips summary messages without created", () => {
    const messages = [
        asMessage({
            info: {
                id: "assistant-earlier",
                sessionID: "session-1",
                role: "assistant",
                summary: true,
                time: { created: 40 },
            },
            parts: [],
        }),
        asMessage({
            info: {
                id: "assistant-latest-valid",
                sessionID: "session-1",
                role: "assistant",
                summary: true,
                time: { created: 80 },
            },
            parts: [],
        }),
        asMessage({
            info: {
                id: "assistant-missing-created",
                sessionID: "session-1",
                role: "assistant",
                summary: true,
            },
            parts: [],
        }),
    ]

    assert.equal(findLastCompactionTimestamp(messages), 80)
})

test("countTurns still counts step-start messages when another message lacks created", () => {
    const state = createState()
    const messages = [
        asMessage({
            info: {
                id: "assistant-step",
                sessionID: "session-1",
                role: "assistant",
                time: { created: 5 },
            },
            parts: [{ type: "step-start" }],
        }),
        asMessage({
            info: {
                id: "assistant-missing-created",
                sessionID: "session-1",
                role: "assistant",
                time: {},
            },
            parts: [],
        }),
    ]

    assert.equal(countTurns(state, messages), 1)
})

test("insertPruneToolContext tolerates a user message without model metadata", () => {
    const state = createState()
    const config = createConfig()
    const logger = createLogger()
    const messages = [
        asMessage({
            info: {
                id: "user-missing-model",
                sessionID: "session-1",
                role: "user",
            },
            parts: [{ type: "text", text: "hello" }],
        }),
    ]

    assert.doesNotThrow(() => insertPruneToolContext(state, config, logger, messages))
    assert.equal(messages[0].parts.length, 2)
})

test("insertMessageIdContext tolerates a user message without model metadata", () => {
    const state = createState()
    const config = createConfig()
    const messages = [
        asMessage({
            info: {
                id: "user-missing-model",
                sessionID: "session-1",
                role: "user",
            },
            parts: [{ type: "text", text: "hello" }],
        }),
    ]

    state.messageIds.byRawId.set("user-missing-model", "m0000")

    assert.doesNotThrow(() => insertMessageIdContext(state, config, messages))
    assert.equal(messages[0].parts.length, 2)
})

test("getCurrentParams returns undefined model metadata when the last user message lacks model", () => {
    const state = createState()
    const logger = createLogger()
    const messages = [
        asMessage({
            info: {
                id: "user-missing-model",
                sessionID: "session-1",
                role: "user",
                agent: "main",
            },
            parts: [{ type: "text", text: "hello" }],
        }),
    ]

    const params = getCurrentParams(state, messages, logger)

    assert.equal(params.providerId, undefined)
    assert.equal(params.modelId, undefined)
    assert.equal(params.agent, "main")
})
