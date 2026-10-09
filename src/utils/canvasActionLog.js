import { createCanvas, loadImage, registerFont } from 'canvas';
import { AttachmentBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

export async function generateGlobalActionCard(opts) {
    const { action, guildName, guildIconUrl, targetTag, targetId, executorName, executorId, reason, timestamp, guildId } = opts;

    const width = 1021;
    const height = 433;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Load background
    const bgPath = path.resolve('./src/assets/banlog_template_clean.png');
    if (fs.existsSync(bgPath)) {
        const bg = await loadImage(bgPath);
        ctx.drawImage(bg, 0, 0, width, height);
    } else {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, width, height);
    }

    // Draw Guild Icon if available (circular) over the top left placeholder
    if (guildIconUrl) {
        try {
            const icon = await loadImage(guildIconUrl);
            ctx.save();
            ctx.beginPath();
            ctx.arc(126, 175, 54, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(icon, 72, 121, 108, 108);
            ctx.restore();
        } catch (e) {
            // Ignore if icon fails to load
        }
    }

    // Set text styling
    ctx.textBaseline = 'top';

    // Executor Tag
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(executorName.length > 20 ? executorName.substring(0, 17) + '...' : executorName, 170, 252);
    
    // Target Tag
    ctx.fillText(targetTag.length > 20 ? targetTag.substring(0, 17) + '...' : targetTag, 595, 252);
    
    // IDs (Blue-ish color)
    ctx.fillStyle = '#4d79ff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(executorId, 170, 292);
    ctx.fillText(targetId, 595, 292);
    
    // Reason (Red color)
    ctx.fillStyle = '#ff3333';
    ctx.font = 'bold 18px sans-serif';
    let displayReason = reason || 'No reason provided';
    if (displayReason.length > 60) displayReason = displayReason.substring(0, 57) + '...';
    ctx.fillText(displayReason, 210, 345);
    
    // Server ID (Grey color)
    ctx.fillStyle = '#a0a0a0';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(guildId, 775, 403);

    const buffer = canvas.toBuffer('image/png');
    return new AttachmentBuilder(buffer, { name: 'action_log.png' });
}
