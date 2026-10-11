import { generateGlobalActionCard } from './canvasActionLog.js';

export async function generateBanLogBuffer(executorTag, targetTag, executorId, targetId, reason, serverId, guildName = 'Unknown Server', guildIconUrl = null) {
    const attachment = await generateGlobalActionCard({
        action: 'MEMBER BANNED',
        guildName,
        guildIconUrl,
        targetTag,
        targetId,
        executorName: executorTag,
        executorId,
        reason,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        guildId: serverId
    });
    return attachment.attachment;
}
