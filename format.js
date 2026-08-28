import fs from "fs";
let code = fs.readFileSync("src/commands/security.js", "utf8");

// Fix indenting using non-breaking spaces
code = code.replace(/   \u21b3 Server Id : /g, '\u00A0\u00A0\u21b3 Server Id : ');
code = code.replace(/   \u21b3 Secure Security DB ID : /g, '\u00A0\u00A0\u21b3 Secure Security DB ID : ');

const startIdx = code.indexOf("export async function getServerSecurityEnabledPanel");
const endIdx = code.indexOf("export async function getSecureDashboardPanel");

if (startIdx !== -1 && endIdx !== -1) {
    const newTOS = `export async function getServerSecurityEnabledPanel() {
    const section1 = { type: 9, components: [{
            type: 10,
            content: "-# <:emoji_16:1533860111704002665> **SERVER SECURITY ENABLED**\\n-# **When server security is enabled these config actions required to from owner/extraowner /whitelist users and Roles**"
        }], accessory: { type: 11, media: { url: "https://upload.wikimedia.org/wikipedia/commons/c/ce/Transparent.gif" } } };

    const section2 = { type: 9, components: [{
            type: 10,
            content: "-# <a:warning:1540656124313993247> **\`!botwhitelist add <bot id>\` - To add bots to server by whitelisted users before that the admin bot comes in either whitelisted to ensure data leaving server owner or extra owner**\\n\\n" +
                     "-# <a:warning:1540656124313993247> **\`!whitelist @user\` - Whitelist users to have securely immunity for the targeted user for whitelisted actions the targeted user is immune for target events**\\n\\n" +
                     "-# <a:warning:1540656124313993247> **\`!whitelist @role\` - The Roles can be whitelisted same as users , attempt to get or give whitelisted role to other user by whitelisted user or extra owner will be sent back in error and giver of whitelisted role will be banned**\\n\\n" +
                     "-# <a:warning:1540656124313993247> **\`#athenas-dashboard\` - A dedicated dashboard channel showing server security status where you can easily configure and toggle Athena's security modules.**\\n\\n" +
                     "-# <a:warning:1540656124313993247> **\`#security-logs\` - A secure webhook channel created automatically for logging all security actions and artifacts.**"
        }], accessory: { type: 11, media: { url: "https://upload.wikimedia.org/wikipedia/commons/c/ce/Transparent.gif" } } };

    const section3 = { type: 9, components: [{
            type: 10,
            content: "-# **Terms of Service (TOS)**\\n\\n" +
                     "-# **Data Privacy Terms: Athena Prime collects strictly minimal server data (guild ID, role IDs, audit log events, and whitelist settings) solely to operate antinuke security. No personal user messages, DMs, or sensitive personal data are recorded, stored, or shared with any third party.**\\n\\n" +
                     "-# **Non-Exploit Terms: Any attempt to exploit, reverse-engineer, bypass security filters, abuse under-bot privileges, or utilize bot features to disrupt or harm servers is strictly forbidden. Violations result in immediate global blacklisting and permanent loss of security privileges.**"
        }], accessory: { type: 11, media: { url: "https://upload.wikimedia.org/wikipedia/commons/c/ce/Transparent.gif" } } };

    const container = {
        type: 17,
        components: [section1, { type: 14, divider: true }, section2, { type: 14, divider: true }, section3]
    };

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}`;

    code = code.substring(0, startIdx) + newTOS + "\n\n" + code.substring(endIdx);
    fs.writeFileSync("src/commands/security.js", code);
    console.log("Rewrote TOS panel with -# everywhere and used non-breaking spaces for pointer!");
}
