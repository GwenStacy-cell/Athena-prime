import { createCanvas, loadImage } from 'canvas';
import { AttachmentBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

export async function generateGlobalActionCard(opts) {
    const { action, guildName, guildIconUrl, targetTag, targetId, executorName, executorId, reason, timestamp, guildId } = opts;

    const width = 960;
    const height = 405;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Load background
    const bgPath = path.resolve('./src/assets/banlog_template.png');
    if (fs.existsSync(bgPath)) {
        const bg = await loadImage(bgPath);
        ctx.drawImage(bg, 0, 0, width, height);
    } else {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, width, height);
    }

    // Clear Executor Tag & Target Tag
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(205, 222, 250, 28);
    ctx.fillRect(665, 222, 250, 28);
    
    // Clear Executor ID & Target ID
    ctx.fillRect(205, 298, 250, 28);
    ctx.fillRect(665, 298, 250, 28);

    // Clear Reason
    ctx.fillRect(218, 350, 680, 28);
    
    // Clear Server ID
    ctx.fillRect(750, 375, 200, 22);

    // Draw Guild Icon if available (circular) over the top left placeholder
    if (guildIconUrl) {
        try {
            const icon = await loadImage(guildIconUrl);
            ctx.save();
            ctx.beginPath();
            ctx.arc(106, 172, 60, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(icon, 46, 112, 120, 120);
            ctx.restore();
        } catch (e) {
            // Ignore if icon fails to load
        }
    }

    // Set text styling
    ctx.textBaseline = 'top';

    // Executor Tag
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(executorName.length > 20 ? executorName.substring(0, 17) + '...' : executorName, 205, 226);
    
    // Target Tag
    ctx.fillText(targetTag.length > 20 ? targetTag.substring(0, 17) + '...' : targetTag, 665, 226);
    
    // IDs (Blue-ish color)
    ctx.fillStyle = '#4d79ff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(executorId, 205, 302);
    ctx.fillText(targetId, 665, 302);
    
    // Reason (Red color)
    ctx.fillStyle = '#ff3333';
    ctx.font = 'bold 20px sans-serif';
    let displayReason = reason || 'No reason provided';
    if (displayReason.length > 60) displayReason = displayReason.substring(0, 57) + '...';
    ctx.fillText(displayReason, 218, 354);
    
    // Server ID (Grey color)
    ctx.fillStyle = '#a0a0a0';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(guildId, 755, 378);

    const buffer = canvas.toBuffer('image/png');
    return new AttachmentBuilder(buffer, { name: 'action_log.png' });
}
