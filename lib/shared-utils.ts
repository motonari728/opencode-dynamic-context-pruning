import type { UserMessage } from "@opencode-ai/sdk/v2"
import { SessionState, WithParts } from "./state"
import { isIgnoredUserMessage } from "./messages/utils"

export interface UserMessageMetadata {
    providerId: string | undefined
    modelId: string | undefined
    agent: string | undefined
    variant: string | undefined
}

export const getMessageCreated = (msg: WithParts | null | undefined): number | undefined => {
    const created = msg?.info?.time?.created
    return typeof created === "number" ? created : undefined
}

export const getUserMessageMetadata = (
    msg: WithParts | null | undefined,
    fallbackVariant?: string,
): UserMessageMetadata => {
    const userInfo = msg?.info as Partial<UserMessage> | undefined

    return {
        providerId:
            typeof userInfo?.model?.providerID === "string" ? userInfo.model.providerID : undefined,
        modelId: typeof userInfo?.model?.modelID === "string" ? userInfo.model.modelID : undefined,
        agent: typeof userInfo?.agent === "string" ? userInfo.agent : undefined,
        variant: fallbackVariant ?? userInfo?.variant,
    }
}

export const isMessageCompacted = (state: SessionState, msg: WithParts): boolean => {
    const created = getMessageCreated(msg)
    if (created !== undefined && created < state.lastCompaction) {
        return true
    }

    if (state.prune.messages.has(msg.info.id)) {
        return true
    }

    return false
}

export const getLastUserMessage = (
    messages: WithParts[],
    startIndex?: number,
): WithParts | null => {
    const start = startIndex ?? messages.length - 1
    for (let i = start; i >= 0; i--) {
        const msg = messages[i]
        if (msg.info.role === "user" && !isIgnoredUserMessage(msg)) {
            return msg
        }
    }
    return null
}
