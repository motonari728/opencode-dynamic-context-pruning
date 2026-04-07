import assert from "node:assert/strict"
import test from "node:test"
import { createSessionState, type SessionState, type WithParts } from "../lib/state"
import { countTurns, findLastCompactionTimestamp } from "../lib/state/utils"
import { isMessageCompacted } from "../lib/shared-utils"

const asMessage = (value: unknown): WithParts => value as WithParts

const createState = (): SessionState => createSessionState()

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
